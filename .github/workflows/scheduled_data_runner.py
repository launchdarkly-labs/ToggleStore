"""
Scheduled Data Runner — generates AI monitoring + agent graph data
for all active ToggleStore environments.

Discovers *-togglestore projects via the LD API, resolves each project's
production SDK key, and runs a batch of monitoring + agent graph data
through the AI SDK trackers.

Usage:
    Runs automatically via the scheduled_data_generator.yaml workflow
    (every 2 hours) or can be triggered manually via workflow_dispatch.

    Set SPECIFIC_NAMESPACE env var to run for a single namespace only
    (e.g. "events5" → targets "events5-togglestore").

Required env vars:
    LD_API_KEY — LaunchDarkly API key with read access to projects
"""

import os
import sys
import logging
import time
import requests
import random
import uuid
from contextlib import contextmanager

import ldclient
from ldclient.config import Config
from ldclient.context import Context
from ldai.client import LDAIClient
from ldai.tracker import TokenUsage, FeedbackKind

try:
    from ldobserve import ObservabilityConfig, ObservabilityPlugin
    from opentelemetry import trace
    OBSERVABILITY_AVAILABLE = True
except ImportError:
    OBSERVABILITY_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


AGENT_PROMPTS = {
    "triage": "Classify this customer query into one category: product, order, or style. Query: '{question}'. Reply with just the category.",
    "specialist": "As a shopping assistant, give a one-sentence answer to: '{question}'",
    "brand-voice": "Rewrite this in a friendly brand voice: '{response}'",
}


def _make_llm_call(role, question, response=""):
    """Make a small real OpenAI call for trace generation."""
    if not OPENAI_AVAILABLE or not os.getenv("OPENAI_API_KEY"):
        return None, {"input": 0, "output": 0}
    try:
        client = OpenAI()
        prompt = AGENT_PROMPTS.get(role, "Say 'ok'").format(question=question, response=response)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=30,
            temperature=0.7,
        )
        text = resp.choices[0].message.content or ""
        usage = resp.usage
        tokens = {
            "input": usage.prompt_tokens if usage else 0,
            "output": usage.completion_tokens if usage else 0,
        }
        return text, tokens
    except Exception as e:
        logging.debug(f"LLM call failed ({role}): {e}")
        return None, {"input": 0, "output": 0}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

LD_API_KEY = os.getenv("LD_API_KEY")
LD_API_URL = "https://app.launchdarkly.com/api/v2"
HEADERS = {"Authorization": LD_API_KEY, "Content-Type": "application/json"}

MULTI_AGENT_KEYS = [
    "ai-config--togglestore-triage",
    "ai-config--togglestore-product-specialist",
    "ai-config--togglestore-order-specialist",
    "ai-config--togglestore-style-advisor",
    "ai-config--togglestore-brand-voice",
]

MULTI_AGENT_PROFILES = {
    "ai-config--togglestore-triage": {
        "label": "Triage Agent",
        "duration_range": (200, 800),
        "prompt_tokens_range": (50, 150),
        "completion_tokens_range": (30, 100),
        "success_rate": 0.97,
        "positive_feedback_rate": 0.70,
    },
    "ai-config--togglestore-product-specialist": {
        "label": "Product Specialist",
        "duration_range": (500, 2500),
        "prompt_tokens_range": (100, 400),
        "completion_tokens_range": (150, 600),
        "success_rate": 0.95,
        "positive_feedback_rate": 0.75,
    },
    "ai-config--togglestore-order-specialist": {
        "label": "Order & Returns Specialist",
        "duration_range": (400, 2000),
        "prompt_tokens_range": (80, 300),
        "completion_tokens_range": (100, 500),
        "success_rate": 0.94,
        "positive_feedback_rate": 0.65,
    },
    "ai-config--togglestore-style-advisor": {
        "label": "Style & Sizing Advisor",
        "duration_range": (600, 3000),
        "prompt_tokens_range": (120, 450),
        "completion_tokens_range": (200, 700),
        "success_rate": 0.96,
        "positive_feedback_rate": 0.80,
    },
    "ai-config--togglestore-brand-voice": {
        "label": "Brand Voice Agent",
        "duration_range": (300, 1500),
        "prompt_tokens_range": (200, 500),
        "completion_tokens_range": (150, 600),
        "success_rate": 0.98,
        "positive_feedback_rate": 0.78,
    },
}

AGENT_GRAPH_KEY = "togglestore-shopping-pipeline"

TRIAGE_ROUTES = {
    "ai-config--togglestore-product-specialist": 0.35,
    "ai-config--togglestore-order-specialist": 0.25,
    "ai-config--togglestore-style-advisor": 0.30,
}

SHOPPING_QUESTIONS = [
    "What size should I get in the Toggle Hoodie?",
    "Can I return the Osmo Sneakers if they don't fit?",
    "What's the best jacket for cold weather?",
    "Do you have the Toggle Backpack in black?",
    "I need a gift for someone who likes streetwear.",
    "My order hasn't arrived yet. It's been 5 days.",
    "What material is the Feature Flag Tee made of?",
    "Compare the Osmo Sneakers with the Toggle Runners.",
    "I want to exchange my Toggle Cap for a different color.",
    "What are the most popular items right now?",
    "Do you offer express shipping?",
    "The zipper on my Toggle Hoodie broke. Can I get a replacement?",
    "What outfit would go well with the Dark Mode joggers?",
    "Are there any upcoming sales or promotions?",
    "Can you help me find a professional outfit for a tech conference?",
]


def generate_user_context():
    user_key = f"user-{uuid.uuid4()}"
    builder = Context.builder(user_key)
    builder.set("name", f"User {user_key[:8]}")
    builder.set("email", f"user-{user_key[:8]}@example.com")
    builder.set("tier", random.choice(["Standard", "Platinum"]))
    builder.set("role", random.choice(["Developer", "Beta", "Standard"]))
    return builder.build()


def discover_togglestore_projects():
    """Find all *-togglestore projects via the LD API."""
    specific = os.getenv("SPECIFIC_NAMESPACE", "").strip()
    if specific:
        project_key = f"{specific}-togglestore"
        logging.info(f"Running for specific namespace: {specific} → {project_key}")
        return [project_key]

    logging.info("Discovering all ToggleStore projects...")
    projects = []
    offset = 0
    limit = 20

    while True:
        url = f"{LD_API_URL}/projects?limit={limit}&offset={offset}"
        resp = requests.get(url, headers=HEADERS)
        if not resp.ok:
            logging.error(f"Failed to list projects: {resp.status_code} {resp.text}")
            break

        data = resp.json()
        items = data.get("items", [])
        for proj in items:
            key = proj.get("key", "")
            if key.endswith("-togglestore"):
                projects.append(key)

        total = data.get("totalCount", 0)
        offset += limit
        if offset >= total:
            break

    logging.info(f"Found {len(projects)} ToggleStore projects: {projects}")
    return sorted(projects)


def get_sdk_key(project_key):
    """Fetch the production environment's SDK key for a project."""
    url = f"{LD_API_URL}/projects/{project_key}/environments/production"
    resp = requests.get(url, headers=HEADERS)
    if not resp.ok:
        logging.error(f"Failed to get environment for {project_key}: {resp.status_code}")
        return None
    return resp.json().get("apiKey")


def run_monitoring_batch(client, aiclient, runs_per_agent=300):
    """Generate monitoring data for all 5 multi-agent configs."""
    for agent_key in MULTI_AGENT_KEYS:
        profile = MULTI_AGENT_PROFILES[agent_key]
        for i in range(runs_per_agent):
            try:
                ctx = generate_user_context()
                agent_cfg = aiclient.agent_config(agent_key, ctx)
                tracker = agent_cfg.create_tracker()

                dur_min, dur_max = profile["duration_range"]
                duration = random.randint(dur_min, dur_max)
                pt_min, pt_max = profile["prompt_tokens_range"]
                ct_min, ct_max = profile["completion_tokens_range"]
                pt = random.randint(pt_min, pt_max)
                ct = random.randint(ct_min, ct_max)

                tracker.track_duration(duration)
                tracker.track_tokens(TokenUsage(pt, ct, pt + ct))
                tracker.track_time_to_first_token(random.randint(30, max(50, duration // 3)))

                if random.random() < profile["success_rate"]:
                    tracker.track_success()
                else:
                    tracker.track_error()

                if random.random() < profile["positive_feedback_rate"]:
                    tracker.track_feedback({"kind": FeedbackKind.Positive})
                else:
                    tracker.track_feedback({"kind": FeedbackKind.Negative})
            except Exception as e:
                logging.debug(f"Monitoring error ({agent_key}): {e}")

            if (i + 1) % 100 == 0:
                client.flush()
        client.flush()


def run_agent_graph_batch(client, aiclient, num_iterations=200):
    """Generate agent graph data with handoffs, paths, per-node metrics, and OTel traces."""
    tracer = _get_tracer()
    question_pool = SHOPPING_QUESTIONS
    use_llm = OPENAI_AVAILABLE and bool(os.getenv("OPENAI_API_KEY"))

    for i in range(num_iterations):
        try:
            ctx = generate_user_context()
            question = random.choice(question_pool)
            graph = aiclient.agent_graph(AGENT_GRAPH_KEY, ctx)

            if not graph.is_enabled():
                if i == 0:
                    logging.warning(f"Agent graph '{AGENT_GRAPH_KEY}' is disabled — skipping")
                    return
                continue

            graph_tracker = graph.create_tracker()
            root_node = graph.root()
            if root_node is None:
                continue

            total_in = 0
            total_out = 0
            graph_start = time.time()

            # Pick specialist route for this iteration
            specialist_key = random.choices(
                list(TRIAGE_ROUTES.keys()),
                weights=list(TRIAGE_ROUTES.values()),
                k=1,
            )[0]

            # Wrap entire pipeline in a parent span (becomes a trace in LD)
            with safe_span(tracer, "togglestore.agent-pipeline", attributes={
                "gen_ai.system": "togglestore",
                "gen_ai.operation.name": "agent-graph",
                "agent.graph_key": AGENT_GRAPH_KEY,
                "agent.question": question,
            }) as pipeline_span:

                # --- Node 1: Triage ---
                triage_key = root_node.get_key()
                triage_cfg = root_node.get_config()
                triage_model = triage_cfg.model.name if triage_cfg.model else "unknown"

                with safe_span(tracer, "agent.triage", attributes={
                    "gen_ai.system": "togglestore",
                    "gen_ai.request.model": triage_model,
                    "agent.name": triage_key,
                    "agent.role": "triage",
                }) as triage_span:
                    t = triage_cfg.create_tracker()
                    if use_llm:
                        _make_llm_call("triage", question)
                    triage_dur = random.randint(200, 800)
                    triage_pt = random.randint(50, 150)
                    triage_ct = random.randint(30, 100)
                    t.track_duration(triage_dur)
                    t.track_tokens(TokenUsage(triage_pt, triage_ct, triage_pt + triage_ct))
                    t.track_time_to_first_token(random.randint(30, min(80, triage_dur)))
                    t.track_success()
                    total_in += triage_pt
                    total_out += triage_ct
                    triage_span.set_attribute("gen_ai.usage.input_tokens", triage_pt)
                    triage_span.set_attribute("gen_ai.usage.output_tokens", triage_ct)
                    triage_span.set_attribute("agent.duration_ms", triage_dur)
                    triage_span.set_attribute("agent.routed_to", specialist_key)

                # --- Node 2: Specialist ---
                specialist_node = graph.get_node(specialist_key)
                spec_profile = MULTI_AGENT_PROFILES.get(
                    specialist_key, MULTI_AGENT_PROFILES["ai-config--togglestore-product-specialist"]
                )
                spec_dur = 0

                if specialist_node is not None:
                    spec_cfg = specialist_node.get_config()
                    spec_model = spec_cfg.model.name if spec_cfg.model else "unknown"

                    with safe_span(tracer, "agent.specialist", attributes={
                        "gen_ai.system": "togglestore",
                        "gen_ai.request.model": spec_model,
                        "agent.name": specialist_key,
                        "agent.role": "specialist",
                    }) as spec_span:
                        st = spec_cfg.create_tracker()
                        spec_response = ""
                        if use_llm:
                            resp, _ = _make_llm_call("specialist", question)
                            spec_response = resp or ""
                        dur_min, dur_max = spec_profile["duration_range"]
                        spec_dur = random.randint(dur_min, dur_max)
                        pt_min, pt_max = spec_profile["prompt_tokens_range"]
                        ct_min, ct_max = spec_profile["completion_tokens_range"]
                        spec_pt = random.randint(pt_min, pt_max)
                        spec_ct = random.randint(ct_min, ct_max)
                        st.track_duration(spec_dur)
                        st.track_tokens(TokenUsage(spec_pt, spec_ct, spec_pt + spec_ct))
                        st.track_time_to_first_token(random.randint(40, max(50, spec_dur // 4)))
                        st.track_success()
                        total_in += spec_pt
                        total_out += spec_ct
                        graph_tracker.track_handoff_success(triage_key, specialist_key)
                        spec_span.set_attribute("gen_ai.usage.input_tokens", spec_pt)
                        spec_span.set_attribute("gen_ai.usage.output_tokens", spec_ct)
                        spec_span.set_attribute("agent.duration_ms", spec_dur)

                # --- Node 3: Brand Voice ---
                brand_key = "ai-config--togglestore-brand-voice"
                brand_node = graph.get_node(brand_key)
                execution_path = [triage_key, specialist_key]
                brand_dur = 0

                if brand_node is not None:
                    brand_cfg = brand_node.get_config()
                    brand_model = brand_cfg.model.name if brand_cfg.model else "unknown"

                    with safe_span(tracer, "agent.brand-voice", attributes={
                        "gen_ai.system": "togglestore",
                        "gen_ai.request.model": brand_model,
                        "agent.name": brand_key,
                        "agent.role": "brand-voice",
                    }) as brand_span:
                        bt = brand_cfg.create_tracker()
                        if use_llm:
                            _make_llm_call("brand-voice", question, response=spec_response if specialist_node else "")
                        brand_dur = random.randint(300, 1500)
                        brand_pt = random.randint(200, 500)
                        brand_ct = random.randint(150, 600)
                        bt.track_duration(brand_dur)
                        bt.track_tokens(TokenUsage(brand_pt, brand_ct, brand_pt + brand_ct))
                        bt.track_time_to_first_token(random.randint(30, max(50, brand_dur // 5)))
                        bt.track_success()
                        if random.random() < 0.78:
                            bt.track_feedback({"kind": FeedbackKind.Positive})
                        else:
                            bt.track_feedback({"kind": FeedbackKind.Negative})
                        total_in += brand_pt
                        total_out += brand_ct
                        graph_tracker.track_handoff_success(specialist_key, brand_key)
                        execution_path.append(brand_key)
                        brand_span.set_attribute("gen_ai.usage.input_tokens", brand_pt)
                        brand_span.set_attribute("gen_ai.usage.output_tokens", brand_ct)
                        brand_span.set_attribute("agent.duration_ms", brand_dur)

                # Graph-level metrics
                graph_duration = int((time.time() - graph_start) * 1000) + triage_dur + spec_dur + brand_dur
                graph_tracker.track_total_tokens(TokenUsage(total_in, total_out, total_in + total_out))
                graph_tracker.track_invocation_success()
                graph_tracker.track_duration(graph_duration)
                graph_tracker.track_path(execution_path)

                pipeline_span.set_attribute("agent.execution_path", " -> ".join(execution_path))
                pipeline_span.set_attribute("gen_ai.usage.input_tokens", total_in)
                pipeline_span.set_attribute("gen_ai.usage.output_tokens", total_out)
                pipeline_span.set_attribute("agent.total_duration_ms", graph_duration)

            if (i + 1) % 50 == 0:
                _flush_traces()
                client.flush()
                time.sleep(0.1)

        except Exception as e:
            logging.debug(f"Agent graph iteration {i} error: {e}")
            continue

    _flush_traces()
    client.flush()


def run_chatbot_monitoring_batch(client, aiclient, num_runs=200):
    """Generate monitoring data for the main chatbot AI config."""
    chatbot_key = "ai-config--togglebotchatbot"
    for i in range(num_runs):
        try:
            ctx = generate_user_context()
            cfg = aiclient.completion_config(chatbot_key, ctx)
            t = cfg.create_tracker()
            dur = random.randint(500, 2000)
            pt = random.randint(20, 100)
            ct = random.randint(50, 500)
            t.track_duration(dur)
            t.track_tokens(TokenUsage(pt, ct, pt + ct))
            t.track_time_to_first_token(random.randint(50, dur))
            if random.random() < 0.95:
                t.track_success()
            else:
                t.track_error()
            t.track_feedback({"kind": FeedbackKind.Positive if random.random() < 0.5 else FeedbackKind.Negative})
        except Exception as e:
            logging.debug(f"Chatbot monitoring error: {e}")
        if (i + 1) % 100 == 0:
            client.flush()


def _get_tracer():
    """Get an OpenTelemetry tracer for synthetic agent graph spans."""
    if not OBSERVABILITY_AVAILABLE:
        return None
    try:
        return trace.get_tracer("togglestore.agent-graph", "1.0.0")
    except Exception:
        return None


@contextmanager
def safe_span(tracer, name, **kwargs):
    """Create a span, falling back to a no-op if tracing is unavailable."""
    if tracer is None:
        class _NoOp:
            def set_attribute(self, k, v): pass
            def __enter__(self): return self
            def __exit__(self, *a): return False
        yield _NoOp()
        return
    try:
        with tracer.start_as_current_span(name, **kwargs) as span:
            yield span
    except Exception:
        class _NoOp:
            def set_attribute(self, k, v): pass
        yield _NoOp()


def _flush_traces():
    """Flush all pending OpenTelemetry spans."""
    if not OBSERVABILITY_AVAILABLE:
        return
    try:
        provider = trace.get_tracer_provider()
        if hasattr(provider, "force_flush"):
            provider.force_flush(timeout_millis=10000)
            logging.info("  Trace spans flushed")
    except Exception as e:
        logging.debug(f"  Failed to flush traces: {e}")


def process_project(project_key, sdk_key):
    """Run a full data generation cycle for a single project."""
    logging.info(f"  Initializing SDK for {project_key}...")

    if OBSERVABILITY_AVAILABLE:
        obs_config = ObservabilityConfig(
            service_name="togglestore-synthetic-data",
        )
        config = Config(
            sdk_key=sdk_key,
            plugins=[ObservabilityPlugin(obs_config)],
            events_max_pending=5000,
            flush_interval=5.0,
        )
        logging.info(f"  [{project_key}] Observability plugin enabled (traces will be exported)")
    else:
        config = Config(
            sdk_key=sdk_key,
            events_max_pending=5000,
            flush_interval=5.0,
        )
        logging.info(f"  [{project_key}] Observability not available, metrics only")

    ldclient.set_config(config)
    client = ldclient.get()

    if not client.is_initialized():
        logging.error(f"  Failed to initialize client for {project_key}")
        return

    aiclient = LDAIClient(client)

    try:
        logging.info(f"  [{project_key}] Generating chatbot monitoring data...")
        run_chatbot_monitoring_batch(client, aiclient, num_runs=200)

        logging.info(f"  [{project_key}] Generating multi-agent monitoring data (300/agent)...")
        run_monitoring_batch(client, aiclient, runs_per_agent=300)

        logging.info(f"  [{project_key}] Generating agent graph data with traces (200 iterations)...")
        run_agent_graph_batch(client, aiclient, num_iterations=200)

        _flush_traces()
        client.flush()
        time.sleep(2)
        client.flush()
        time.sleep(1)
        logging.info(f"  [{project_key}] Done.")
    finally:
        _flush_traces()
        client.close()


def main():
    if not LD_API_KEY:
        logging.error("LD_API_KEY not set. Exiting.")
        sys.exit(1)

    projects = discover_togglestore_projects()
    if not projects:
        logging.warning("No ToggleStore projects found. Exiting.")
        return

    logging.info(f"Processing {len(projects)} projects...")

    for project_key in projects:
        logging.info(f"\n{'='*60}")
        logging.info(f"Project: {project_key}")
        logging.info(f"{'='*60}")

        sdk_key = get_sdk_key(project_key)
        if not sdk_key:
            logging.warning(f"  Skipping {project_key} — could not retrieve SDK key")
            continue

        try:
            process_project(project_key, sdk_key)
        except Exception as e:
            logging.error(f"  Error processing {project_key}: {e}")
            continue

    logging.info("\nAll projects processed. Scheduled data generation complete.")


if __name__ == "__main__":
    main()
