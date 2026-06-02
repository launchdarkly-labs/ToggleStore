import os
import sys
import logging
import requests
import uuid
import ldclient
from ldclient.config import Config
from ldclient.context import Context
from dotenv import load_dotenv
import random
import time
import threading
from contextlib import contextmanager
from datetime import datetime
from ldai.client import LDAIClient
from ldai.tracker import TokenUsage, FeedbackKind

try:
    from ldobserve import ObservabilityConfig, ObservabilityPlugin
    from ldobserve import observe as ldobserve_api
    from opentelemetry import trace
    from opentelemetry.trace import StatusCode
    OBSERVABILITY_AVAILABLE = True
except ImportError:
    OBSERVABILITY_AVAILABLE = False
    StatusCode = None
    ldobserve_api = None

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

load_dotenv()

LD_API_KEY = os.getenv("LD_API_KEY")
PROJECT_KEY = os.getenv("LD_PROJECT_KEY")
LD_API_URL = os.getenv("LD_API_URL", "https://app.launchdarkly.com/api/v2")
ENVIRONMENT_KEY = "production"

HEADERS = {
    "Authorization": LD_API_KEY,
    "Content-Type": "application/json"
}

# Flag keys
PAYMENTS_FLAG_KEY = "paymentsSystemsUpgrade"
EMAIL_SERVICE_FLAG_KEY = "emailNotificationServiceUpgrade"
INVENTORY_SYNC_FLAG_KEY = "inventorySyncUpgrade"
SEARCH_ALGORITHM_FLAG_KEY = "searchAlgorithm"
STORE_PROMO_FLAG_KEY = "storePromoBanner"
AI_CONFIG_FLAG_KEY = "ai-config--togglebotchatbot"

# Payment metrics
PAYMENT_SUCCESS_RATE_KEY = "payment-success-rate"
PAYMENT_LATENCY_KEY = "payment-latency"
PAYMENT_ERROR_RATE_KEY = "payment-error-rate"

# Email notification service metrics
EMAIL_ERROR_RATE_KEY = "email-error-rate"
EMAIL_LATENCY_KEY = "email-latency"
EMAIL_DELIVERY_RATE_KEY = "email-delivery-rate"

# Search algorithm experiment metrics
SEARCH_STARTED_KEY = "search-started"
ADD_TO_CART_FROM_SEARCH_KEY = "add-to-cart-from-search"
CART_TOTAL_KEY = "cart-total"

# Store promo banner experiment metrics
STORE_PURCHASES_KEY = "store-purchases"  # Metric group

# AI Config experiment metrics
AI_ACCURACY_KEY = "ai-accuracy"
AI_SOURCE_FIDELITY_KEY = "ai-source-fidelity"
AI_RELEVANCE_KEY = "ai-relevance"
AI_COST_KEY = "ai-cost"
AI_CHATBOT_NEGATIVE_FEEDBACK_KEY = "ai-chatbot-negative-feedback"


# Shopping Assistant Agent AI Config
SHOPPING_ASSISTANT_AGENT_FLAG_KEY = "ai-config--togglestore-shopping-assistant-agent"
SHOPPING_AGENT_ACCURACY_KEY = "shopping-agent-accuracy"
SHOPPING_AGENT_NEGATIVE_FEEDBACK_KEY = "shopping-agent-negative-feedback"

# Multi-Agent Pipeline AI Config keys
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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

def get_flag_details(flag_key):
    url = f"{LD_API_URL}/flags/{PROJECT_KEY}/{flag_key}"
    response = requests.get(url, headers=HEADERS)
    if not response.ok:
        logging.error(f"Failed to fetch flag details: {response.status_code} {response.text}")
        return None
    return response.json()

def is_measured_rollout(flag_details):
    """Check if flag has an active measured rollout"""
    try:
        env = flag_details['environments'][ENVIRONMENT_KEY]
        fallthrough = env.get('fallthrough', {})
        rollout = fallthrough.get('rollout')
        return rollout is not None
    except Exception as e:
        logging.error(f"Error checking measured rollout: {str(e)}")
        return False

def _upgrade_inventory_sync_metric():
    """Check if the autogenerated error metric exists (seeded at start of run),
    then update the inventory sync flag's measured rollout to include it."""
    autogen_key = "ld_autogen__telemetry-default-error-rate"
    check_url = f"{LD_API_URL}/metrics/{PROJECT_KEY}/{autogen_key}"

    resp = requests.get(check_url, headers=HEADERS)
    if not resp.ok:
        logging.info("Autogenerated metric not found yet. Polling (session:init was sent at start)...")
        for attempt in range(24):
            time.sleep(10)
            resp = requests.get(check_url, headers=HEADERS)
            if resp.ok:
                logging.info(f"Autogenerated metric appeared after {(attempt + 1) * 10}s of polling")
                break
            logging.info(f"  Still waiting... ({(attempt + 1) * 10}s)")
        else:
            logging.warning(f"Autogenerated metric '{autogen_key}' did not appear after 240s. "
                            "Error detection on flag page will not be available.")
            return

    logging.info(f"Found autogenerated metric: {autogen_key}")

    metrics_for_rollout = [autogen_key]
    logging.info(f"Creating guarded rollout for {INVENTORY_SYNC_FLAG_KEY} with metric: {autogen_key}")

    flag_url = f"{LD_API_URL}/flags/{PROJECT_KEY}/{INVENTORY_SYNC_FLAG_KEY}"
    resp = requests.get(flag_url, headers=HEADERS)
    if not resp.ok:
        logging.error(f"Failed to fetch flag details for guarded rollout: {resp.status_code}")
        return

    flag_data = resp.json()
    variations = flag_data.get("variations", [])
    control_var = ""
    test_var = ""
    for v in variations:
        if v["value"] is False:
            control_var = v["_id"]
        else:
            test_var = v["_id"]

    if not control_var or not test_var:
        logging.error("Could not find variation IDs for guarded rollout")
        return

    stage_window = 120000
    rollout_url = f"{flag_url}?ignoreConflicts=true"
    rollout_headers = {
        "Authorization": LD_API_KEY,
        "Content-Type": "application/json; domain-model=launchdarkly.semanticpatch",
    }
    rollout_payload = {
        "comment": "",
        "environmentKey": ENVIRONMENT_KEY,
        "instructions": [
            {"kind": "turnFlagOn"},
            {
                "kind": "updateFallthroughWithMeasuredRolloutV2",
                "testVariationId": test_var,
                "metrics": [
                    {
                        "metricKey": m,
                        "regressionThreshold": 0,
                        "onRegression": {"rollback": True, "notify": True}
                    } for m in metrics_for_rollout
                ],
                "controlVariationId": control_var,
                "randomizationUnit": "user",
                "onRegression": {"notify": True, "rollback": True},
                "onProgression": {"notify": True, "rollForward": True},
                "monitoringWindowMilliseconds": 604800000,
                "rolloutWeight": 50000,
                "metricKeys": metrics_for_rollout,
                "stages": [
                    {"rolloutWeight": 1000, "monitoringWindowMilliseconds": stage_window},
                    {"rolloutWeight": 5000, "monitoringWindowMilliseconds": stage_window},
                    {"rolloutWeight": 10000, "monitoringWindowMilliseconds": stage_window},
                    {"rolloutWeight": 25000, "monitoringWindowMilliseconds": stage_window},
                    {"rolloutWeight": 50000, "monitoringWindowMilliseconds": stage_window},
                ]
            }
        ],
    }
    resp = requests.patch(rollout_url, headers=rollout_headers, json=rollout_payload)
    if resp.ok:
        logging.info(f"Guarded rollout created for {INVENTORY_SYNC_FLAG_KEY} with autogenerated error metric")
    else:
        logging.error(f"Failed to create guarded rollout: {resp.status_code} {resp.text}")

def generate_user_context():
    """Generate a random user context for flag evaluation"""
    user_key = f"user-{uuid.uuid4()}"
    builder = Context.builder(user_key)
    builder.set("name", f"Test User {user_key[:8]}")
    builder.set("email", f"test-{user_key[:8]}@example.com")
    builder.set("tier", random.choice(["Standard", "Platinum"]))
    builder.set("role", random.choice(["Developer", "Beta", "Standard"]))
    builder.set("location", random.choice(["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]))
    builder.set("device", random.choice(["mobile", "desktop", "tablet"]))
    builder.set("operating_system", random.choice(["windows", "macos", "ios", "android"]))
    return builder.build()

def evaluate_all_flags(client):
    """Evaluate all feature flags to generate exposure events"""
    logging.info("Starting flag evaluation for all flags...")
    
    # Get all flags with togglestore tag
    url = f"{LD_API_URL}/flags/{PROJECT_KEY}?limit=100"
    response = requests.get(url, headers=HEADERS)
    if not response.ok:
        logging.error(f"Failed to fetch flags: {response.status_code} {response.text}")
        return
    
    flags = response.json().get('items', [])
    togglestore_flags = [flag['key'] for flag in flags if 'togglestore' in flag.get('tags', [])]
    
    if not togglestore_flags:
        logging.warning("No togglestore flags found")
        return
    
    logging.info(f"Found {len(togglestore_flags)} togglestore flags to evaluate")
    
    for flag_key in togglestore_flags:
        logging.info(f"Evaluating flag: {flag_key}")
        for _ in range(100):  # 100 evaluations per flag
            try:
                user_context = generate_user_context()
                variation = client.variation(flag_key, user_context, None)
                logging.debug(f"User {user_context.key} got variation '{variation}' for flag '{flag_key}'")
            except Exception as e:
                logging.error(f"Error evaluating flag {flag_key}: {str(e)}")
                continue
    
    logging.info("Flag evaluation completed. Flushing client...")
    client.flush()
    time.sleep(0.5)  # Wait for flush to complete
    logging.info("Flag evaluation finished.")

def _wait_for_measured_rollout(flag_key, label, max_retries=6):
    """Wait for a measured rollout to be ready on the given flag. Returns True if ready."""
    retry_count = 0
    while retry_count < max_retries:
        time.sleep(5)
        flag_details = get_flag_details(flag_key)
        if flag_details and is_measured_rollout(flag_details):
            logging.info(f"✅ {label} rollout is ready!")
            return True
        retry_count += 1
        logging.info(f"Rollout not ready yet, retrying... ({retry_count}/{max_retries})")
    logging.error(f"{label} rollout failed to initialize after {max_retries * 5} seconds. Exiting.")
    return False

def payments_systems_upgrade_generator(client):
    """Guarded rollout generator for payments systems upgrade - SUCCESSFUL release"""
    if not client.is_initialized():
        logging.error("LaunchDarkly client is not initialized for Payments Systems Upgrade")
        return
    
    logging.info("Starting guarded release generator for Payments Systems Upgrade (SUCCESS scenario)...")
    
    # Wait for rollout to be ready
    logging.info("Waiting for flag rollout to be ready...")
    if not _wait_for_measured_rollout(PAYMENTS_FLAG_KEY, "Payments Systems Upgrade"):
        return
    
    user_counter = 0
    flush_counter = 0
    status_check_counter = 0
    
    while True:
        # Check rollout status every 500 users
        if status_check_counter >= 500:
            flag_details = get_flag_details(PAYMENTS_FLAG_KEY)
            if not flag_details or not is_measured_rollout(flag_details):
                logging.info("Measured rollout is over. Exiting Payments Systems Upgrade generator.")
                break
            status_check_counter = 0
        
        try:
            user_context = generate_user_context()
            flag_value = client.variation(PAYMENTS_FLAG_KEY, user_context, False)
            
            # SUCCESS SCENARIO: New version (True) performs aggressively better than legacy
            if flag_value:
                # NEW VERSION (True): Excellent performance - aggressively successful release
                error_rate = 0.1  # 0.1% error rate (extremely low)
                latency = 80      # 80ms latency (very fast)
                success_rate = 99.9  # 99.9% success rate (excellent)
            else:
                # LEGACY VERSION (False): Baseline performance
                error_rate = 1.5   # 1.5% error rate (higher)
                latency = 200     # 200ms latency (slower)
                success_rate = 98.5  # 98.5% success rate (lower)
            
            # Track success rate
            if random.random() < (success_rate / 100):
                client.track(PAYMENT_SUCCESS_RATE_KEY, user_context)
            
            # Track error rate
            if random.random() < (error_rate / 100):
                client.track(PAYMENT_ERROR_RATE_KEY, user_context)
            
            # Track latency with very tight variance for consistency
            latency_variance = 5  # Tight variance: ±5ms
            latency_value = int(latency + random.uniform(-latency_variance, latency_variance))
            client.track(PAYMENT_LATENCY_KEY, user_context, None, latency_value)
            
            user_counter += 1
            flush_counter += 1
            status_check_counter += 1
            
            # Flush events every 200 users to reduce connection pool pressure
            if flush_counter >= 200:
                client.flush()
                flush_counter = 0
                logging.info(f"Flushed payment events (total users: {user_counter})")
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            time.sleep(0.02)  # 20ms delay to reduce event rate
            
        except Exception as e:
            logging.error(f"Error generating payment metrics: {str(e)}")
            continue
    
    logging.info(f"Payments Systems Upgrade generator finished. Total users: {user_counter}")

def email_notification_service_upgrade_generator(client):
    """Guarded rollout generator for email notification service upgrade - FAILED release with rollback"""
    if not client.is_initialized():
        logging.error("LaunchDarkly client is not initialized for Email Notification Service Upgrade")
        return
    
    logging.info("Starting guarded release generator for Email Notification Service Upgrade (FAILURE scenario with rollback)...")
    
    # Wait for rollout to be ready
    logging.info("Waiting for flag rollout to be ready...")
    if not _wait_for_measured_rollout(EMAIL_SERVICE_FLAG_KEY, "Email Notification Service Upgrade"):
        return
    
    user_counter = 0
    flush_counter = 0
    status_check_counter = 0
    alert_triggered = False
    
    while True:
        # Check rollout status every 500 users
        if status_check_counter >= 500:
            flag_details = get_flag_details(EMAIL_SERVICE_FLAG_KEY)
            if not flag_details or not is_measured_rollout(flag_details):
                logging.info("Measured rollout is over. Exiting Email Notification Service Upgrade generator.")
                break
            status_check_counter = 0
        
        try:
            user_context = generate_user_context()
            flag_value = client.variation(EMAIL_SERVICE_FLAG_KEY, user_context, False)
            
            # FAILURE SCENARIO: New version (True) performs aggressively worse - triggers rollback
            if flag_value:
                # NEW VERSION (True): Catastrophic performance - will aggressively trigger rollback
                error_rate = 25.0      # 25% error rate (catastrophically high)
                latency = 8000         # 8000ms latency (extremely slow email sending)
                delivery_rate = 0.60   # 60% delivery rate (very low - many emails failing)
                
                # Trigger alert when first user gets bad version
                if not alert_triggered:
                    logging.warning(f"🚨 Email service rollback triggered at user {user_counter} - high error rate detected!")
                    alert_triggered = True
            else:
                # LEGACY VERSION (False): Excellent baseline performance
                error_rate = 0.2       # 0.2% error rate (very low)
                latency = 150          # 150ms latency (fast email sending)
                delivery_rate = 0.995  # 99.5% delivery rate (excellent)
            
            # Track error rate
            if random.random() < (error_rate / 100):
                client.track(EMAIL_ERROR_RATE_KEY, user_context)
            
            # Track latency with tight variance for consistency
            latency_variance = 500 if flag_value else 20  # Tight variance: ±500ms for bad, ±20ms for good
            latency_value = int(latency + random.uniform(-latency_variance, latency_variance))
            client.track(EMAIL_LATENCY_KEY, user_context, None, latency_value)
            
            # Track delivery rate (success = email delivered)
            if random.random() < delivery_rate:
                client.track(EMAIL_DELIVERY_RATE_KEY, user_context)
            
            user_counter += 1
            flush_counter += 1
            status_check_counter += 1
            
            # Flush events every 200 users to reduce connection pool pressure
            if flush_counter >= 200:
                client.flush()
                flush_counter = 0
                logging.info(f"Flushed email service events (total users: {user_counter})")
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            time.sleep(0.02)  # 20ms delay to reduce event rate
            
        except Exception as e:
            logging.error(f"Error generating email service metrics: {str(e)}")
            continue
    
    logging.info(f"Email Notification Service Upgrade generator finished. Total users: {user_counter}")

def inventory_sync_error_generator(client):
    """Guarded rollout generator for inventory sync upgrade - generates telemetry errors for regression debugging"""
    if not client.is_initialized():
        logging.error("LaunchDarkly client is not initialized for Inventory Sync Upgrade")
        return

    logging.info("Starting guarded release generator for Real-Time Inventory Sync (regression debugging)...")

    logging.info("Waiting for inventory sync rollout to be ready...")
    if not _wait_for_measured_rollout(INVENTORY_SYNC_FLAG_KEY, "Inventory Sync Upgrade"):
        return

    error_types = [
        {
            "error_kind": "InventoryDatabaseConnectionTimeout",
            "error_message": "Connection to inventory database timed out after 30000ms — pool exhausted under real-time sync load",
            "component": "InventoryDatabaseConnector",
            "http_status": 503,
            "http_url": "/api/v2/inventory/sync",
            "affected_resource": "PostgreSQL:inventory_items",
            "severity": "critical",
            "retry_count": 3,
            "latency_ms": 30250,
            "error_stack": (
                "TimeoutError: Connection pool exhausted\n"
                "    at InventoryDatabaseConnector.getConnection (inventory-db.ts:142)\n"
                "    at RealTimeSyncService.syncBatch (sync-service.ts:87)\n"
                "    at InventoryEventHandler.onStockUpdate (event-handler.ts:53)"
            ),
        },
        {
            "error_kind": "StockQuantityMismatchError",
            "error_message": "Stock quantity mismatch detected: warehouse reports 47 units but digital inventory shows 152 for SKU-TGL-HOODIE-BLK-L",
            "component": "StockReconciliationEngine",
            "http_status": 409,
            "http_url": "/api/v2/inventory/reconcile",
            "affected_resource": "SKU:TGL-HOODIE-BLK-L",
            "severity": "high",
            "retry_count": 0,
            "latency_ms": 1850,
            "error_stack": (
                "ConflictError: Stock quantity mismatch\n"
                "    at StockReconciliationEngine.validateCount (reconciliation.ts:201)\n"
                "    at RealTimeSyncService.reconcileItem (sync-service.ts:134)\n"
                "    at BatchProcessor.processUpdate (batch-processor.ts:78)"
            ),
        },
        {
            "error_kind": "ProductCatalogSyncFailure",
            "error_message": "Failed to sync product catalog from upstream supplier API — received malformed JSON payload (2.3MB truncated at 1.8MB)",
            "component": "CatalogSyncAdapter",
            "http_status": 502,
            "http_url": "/api/v2/catalog/upstream-sync",
            "affected_resource": "SupplierAPI:toggle-merchandise-co",
            "severity": "high",
            "retry_count": 2,
            "latency_ms": 12400,
            "error_stack": (
                "SyntaxError: Unexpected end of JSON input\n"
                "    at JSON.parse (<anonymous>)\n"
                "    at CatalogSyncAdapter.parseUpstreamResponse (catalog-sync.ts:93)\n"
                "    at CatalogSyncAdapter.fetchAndSync (catalog-sync.ts:67)\n"
                "    at ScheduledSyncWorker.run (sync-worker.ts:41)"
            ),
        },
        {
            "error_kind": "RedisInventoryCacheCorruption",
            "error_message": "Redis cache returned stale inventory data — cache key inventory:stock:TGL-KB-MECH-PRO has TTL of -1 (never expires) but value is 14 hours old",
            "component": "InventoryCacheLayer",
            "http_status": 500,
            "http_url": "/api/v2/inventory/cache/validate",
            "affected_resource": "Redis:inventory:stock:TGL-KB-MECH-PRO",
            "severity": "critical",
            "retry_count": 1,
            "latency_ms": 45,
            "error_stack": (
                "CacheCorruptionError: Stale data detected\n"
                "    at InventoryCacheLayer.validateEntry (cache-layer.ts:178)\n"
                "    at InventoryCacheLayer.get (cache-layer.ts:92)\n"
                "    at StockCheckService.getAvailability (stock-check.ts:34)"
            ),
        },
        {
            "error_kind": "WebhookDeliveryTimeout",
            "error_message": "Inventory update webhook to fulfillment partner timed out after 15000ms — partner endpoint https://fulfill.partner.io/webhooks/stock returned no response",
            "component": "WebhookDispatcher",
            "http_status": 504,
            "http_url": "/api/v2/webhooks/inventory-update",
            "affected_resource": "Webhook:fulfill-partner-stock-update",
            "severity": "medium",
            "retry_count": 3,
            "latency_ms": 15200,
            "error_stack": (
                "TimeoutError: Webhook delivery timed out\n"
                "    at WebhookDispatcher.send (webhook-dispatcher.ts:112)\n"
                "    at WebhookDispatcher.deliverWithRetry (webhook-dispatcher.ts:85)\n"
                "    at InventoryEventBus.notifyPartners (event-bus.ts:156)"
            ),
        },
        {
            "error_kind": "ConcurrentStockUpdateConflict",
            "error_message": "Optimistic locking failure — concurrent stock update on SKU-TGL-DESKMAT-PRO detected (version 42 expected, got 44)",
            "component": "StockUpdateProcessor",
            "http_status": 409,
            "http_url": "/api/v2/inventory/stock/update",
            "affected_resource": "SKU:TGL-DESKMAT-PRO",
            "severity": "high",
            "retry_count": 2,
            "latency_ms": 320,
            "error_stack": (
                "OptimisticLockError: Version conflict\n"
                "    at StockUpdateProcessor.applyUpdate (stock-update.ts:167)\n"
                "    at StockUpdateProcessor.processWithLock (stock-update.ts:143)\n"
                "    at RealTimeSyncService.handleStockEvent (sync-service.ts:201)"
            ),
        },
        {
            "error_kind": "InventoryAPIRateLimitExceeded",
            "error_message": "Third-party inventory API rate limit exceeded — 429 Too Many Requests (limit: 100 req/min, current: 247 req/min during real-time sync burst)",
            "component": "ThirdPartyInventoryClient",
            "http_status": 429,
            "http_url": "/api/v2/inventory/external/query",
            "affected_resource": "ExternalAPI:inventory-data-provider",
            "severity": "medium",
            "retry_count": 0,
            "latency_ms": 180,
            "error_stack": (
                "RateLimitError: Too many requests\n"
                "    at ThirdPartyInventoryClient.query (external-client.ts:78)\n"
                "    at ThirdPartyInventoryClient.fetchWithBackoff (external-client.ts:52)\n"
                "    at InventoryAggregator.aggregateFromSources (aggregator.ts:119)"
            ),
        },
        {
            "error_kind": "ShippingProviderSyncDisconnect",
            "error_message": "Lost WebSocket connection to shipping provider real-time feed — connection reset by peer after 847 successful events",
            "component": "ShippingProviderConnector",
            "http_status": 502,
            "http_url": "/api/v2/shipping/realtime-feed",
            "affected_resource": "WebSocket:shipping-provider-feed",
            "severity": "critical",
            "retry_count": 5,
            "latency_ms": 0,
            "error_stack": (
                "ConnectionResetError: Connection reset by peer\n"
                "    at ShippingProviderConnector.onClose (shipping-connector.ts:198)\n"
                "    at WebSocket.handleDisconnect (ws-client.ts:87)\n"
                "    at RealTimeFeedManager.reconnect (feed-manager.ts:64)"
            ),
        },
    ]

    inv_tracer = None
    if OBSERVABILITY_AVAILABLE:
        try:
            inv_tracer = trace.get_tracer("togglestore.inventory-sync", "1.0.0")
        except Exception:
            inv_tracer = None
    logging.info(f"Inventory sync traces={'enabled' if inv_tracer else 'disabled'}")

    user_counter = 0
    flush_counter = 0
    status_check_counter = 0
    error_counter = 0

    while True:
        if status_check_counter >= 500:
            flag_details = get_flag_details(INVENTORY_SYNC_FLAG_KEY)
            if not flag_details or not is_measured_rollout(flag_details):
                logging.info("Measured rollout is over. Exiting Inventory Sync Upgrade generator.")
                break
            status_check_counter = 0

        try:
            user_context = generate_user_context()
            error = random.choice(error_types)
            host = f"togglestore-worker-{random.randint(1, 5)}"
            request_id = str(uuid.uuid4())[:12]

            if inv_tracer is not None and ldobserve_api is not None:
                with inv_tracer.start_as_current_span(
                    "inventory-sync.request",
                    attributes={
                        "service.name": "inventory-sync-service",
                        "http.method": "POST",
                        "http.url": error["http_url"],
                        "host.name": host,
                        "deployment.environment": "production",
                        "deployment.version": "2.4.0-rc1",
                        "enduser.id": user_context.key,
                        "request.id": request_id,
                    }
                ) as parent_span:
                    flag_value = client.variation(INVENTORY_SYNC_FLAG_KEY, user_context, False)
                    parent_span.set_attribute("feature_flag.key", INVENTORY_SYNC_FLAG_KEY)
                    parent_span.set_attribute("feature_flag.variant", "real-time-sync" if flag_value else "batch-sync")

                    if flag_value:
                        parent_span.set_attribute("component", error["component"])
                        parent_span.set_attribute("http.status_code", error["http_status"])
                        parent_span.set_attribute("inventory.affected_resource", error["affected_resource"])
                        parent_span.set_attribute("inventory.severity", error["severity"])
                        parent_span.set_attribute("inventory.retry_count", error["retry_count"])
                        parent_span.set_attribute("inventory.latency_ms", error["latency_ms"])

                        parent_span.set_status(StatusCode.ERROR, error["error_message"])

                        parent_span.add_event("inventory.sync.started", attributes={
                            "component": error["component"],
                            "http.url": error["http_url"],
                            "request.id": request_id,
                        })

                        parent_span.add_event("inventory.sync.failed", attributes={
                            "error.kind": error["error_kind"],
                            "http.status_code": error["http_status"],
                            "affected_resource": error["affected_resource"],
                            "severity": error["severity"],
                            "retry_count": error["retry_count"],
                            "latency_ms": error["latency_ms"],
                        })

                        exception_id = str(uuid.uuid4())

                        try:
                            raise type(error["error_kind"], (Exception,), {})(error["error_message"])
                        except Exception as exc:
                            ldobserve_api.record_exception(exc, {
                                "launchdarkly.exception.id": exception_id,
                                "component": error["component"],
                                "severity": error["severity"],
                                "http.status_code": error["http_status"],
                                "http.url": error["http_url"],
                                "affected_resource": error["affected_resource"],
                                "flag.key": INVENTORY_SYNC_FLAG_KEY,
                                "host": host,
                                "request.id": request_id,
                            })

                        client.track("$ld:telemetry:error", user_context, {
                            "launchdarkly.exception.id": exception_id,
                            "exception.type": error["error_kind"],
                            "exception.message": error["error_message"],
                            "service.name": "inventory-sync-service",
                            "component": error["component"],
                            "severity": error["severity"],
                            "http.status_code": error["http_status"],
                            "flag.key": INVENTORY_SYNC_FLAG_KEY,
                        }, 1)
                        error_counter += 1
            else:
                flag_value = client.variation(INVENTORY_SYNC_FLAG_KEY, user_context, False)
                if flag_value:
                    client.track("$ld:telemetry:error", user_context, {
                        "exception.type": error["error_kind"],
                        "exception.message": error["error_message"],
                        "service.name": "inventory-sync-service",
                        "component": error["component"],
                        "severity": error["severity"],
                        "http.status_code": error["http_status"],
                        "flag.key": INVENTORY_SYNC_FLAG_KEY,
                    }, 1)
                    error_counter += 1

            user_counter += 1
            flush_counter += 1
            status_check_counter += 1

            if flush_counter >= 200:
                client.flush()
                flush_counter = 0
                logging.info(f"Flushed inventory sync events (total users: {user_counter}, errors: {error_counter})")
                time.sleep(0.1)

            time.sleep(0.02)

        except Exception as e:
            logging.error(f"Error generating inventory sync telemetry: {str(e)}")
            continue

    logging.info(f"Inventory Sync Upgrade generator finished. Total users: {user_counter}, errors: {error_counter}")

def search_algorithm_experiment_generator(client):
    """Experiment results generator for search algorithm - featured-list variation wins"""
    logging.info("Starting experiment results generation for Search Algorithm...")
    
    NUM_USERS = 3000
    
    for i in range(NUM_USERS):
        try:
            user_context = generate_user_context()
            variation = client.variation(SEARCH_ALGORITHM_FLAG_KEY, user_context, False)
            
            # Track search started
            client.track(SEARCH_STARTED_KEY, user_context)
            
            # featured-list variation should WIN - better conversion rates
            if variation == "featured-list":
                # WINNER: Higher engagement and conversion
                add_to_cart_probability = 0.65  # 65% add to cart from search
                avg_cart_total = random.randint(150, 800)  # Higher cart values
            elif variation == "simple-search":
                # Simple Search: Moderate performance
                add_to_cart_probability = 0.55  # 55% add to cart
                avg_cart_total = random.randint(100, 600)
            else:
                # Control/False: Baseline performance
                add_to_cart_probability = 0.45  # 45% add to cart
                avg_cart_total = random.randint(80, 500)
            
            # Track add to cart from search
            if random.random() < add_to_cart_probability:
                client.track(ADD_TO_CART_FROM_SEARCH_KEY, user_context)
                # Track cart total
                client.track(CART_TOTAL_KEY, user_context, None, avg_cart_total)
                logging.debug(f"User {user_context.key} added to cart with {variation} variation")
            
            # Flush more frequently to prevent event buffer overflow
            if (i + 1) % 50 == 0:
                logging.info(f"Processed {i + 1} users for Search Algorithm experiment")
                client.flush()
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            # Small delay to prevent SDK overload
            time.sleep(0.005)  # 5ms delay = ~200 events/sec
                
        except Exception as e:
            logging.error(f"Error processing user {i}: {str(e)}")
            continue
    
    logging.info("Search Algorithm experiment results generation completed")
    client.flush()
    time.sleep(0.5)  # Wait for final flush to complete

def store_promo_banner_experiment_generator(client):
    """Experiment results generator for store promo banner - NEUTRAL (no clear winner)"""
    logging.info("Starting experiment results generation for Store Promo Banner...")
    
    NUM_USERS = 3000
    
    for i in range(NUM_USERS):
        try:
            user_context = generate_user_context()
            variation = client.variation(STORE_PROMO_FLAG_KEY, user_context, "Flash Sale")
            
            # NEUTRAL SCENARIO: All variations perform similarly (no clear winner)
            # Slight variations to make it realistic but keep results close
            
            if variation == "Flash Sale":
                # Slight edge but not significant
                store_access_rate = 0.75
                item_add_rate = 0.60
                cart_access_rate = 0.55
                checkout_rate = 0.48
                avg_cart_total = random.randint(100, 600)
            elif variation == "Free Shipping":
                # Similar performance
                store_access_rate = 0.73
                item_add_rate = 0.58
                cart_access_rate = 0.53
                checkout_rate = 0.46
                avg_cart_total = random.randint(95, 580)
            else:  # "20 Percent Off"
                # Similar performance
                store_access_rate = 0.74
                item_add_rate = 0.59
                cart_access_rate = 0.54
                checkout_rate = 0.47
                avg_cart_total = random.randint(98, 590)
            
            # Simulate funnel progression
            if random.random() < store_access_rate:
                # Step 1: Store accessed (part of store-purchases metric group)
                # We'll track this as part of the funnel
                if random.random() < item_add_rate:
                    # Step 2: Item added
                    if random.random() < cart_access_rate:
                        # Step 3: Cart accessed
                        if random.random() < checkout_rate:
                            # Step 4: Checkout complete (part of store-purchases metric group)
                            # Track cart total
                            client.track(CART_TOTAL_KEY, user_context, None, avg_cart_total)
                            logging.debug(f"User {user_context.key} completed checkout with {variation} variation")
            
            # Track store purchases metric group events
            # The metric group tracks: store-accessed -> add-to-cart -> cart-accessed -> checkout-complete
            # We'll simulate this by tracking the events in sequence
            if random.random() < store_access_rate:
                client.track("store-accessed", user_context)
                if random.random() < item_add_rate:
                    client.track("add-to-cart", user_context)
                    if random.random() < cart_access_rate:
                        client.track("cart-accessed", user_context)
                        if random.random() < checkout_rate:
                            client.track("checkout-complete", user_context)
            
            # Flush more frequently to prevent event buffer overflow
            if (i + 1) % 50 == 0:
                logging.info(f"Processed {i + 1} users for Store Promo Banner experiment")
                client.flush()
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            # Small delay to prevent SDK overload
            time.sleep(0.005)  # 5ms delay = ~200 events/sec
                
        except Exception as e:
            logging.error(f"Error processing user {i}: {str(e)}")
            continue
    
    logging.info("Store Promo Banner experiment results generation completed")
    client.flush()
    time.sleep(0.5)  # Wait for final flush to complete

def ai_config_experiment_generator(client):
    """Experiment results generator for AI Config - NEUTRAL (no clear winner)"""
    logging.info("Starting experiment results generation for AI Config (ToggleBot Chatbot)...")
    
    NUM_USERS = 3000
    
    for i in range(NUM_USERS):
        try:
            user_context = generate_user_context()
            variation = client.variation(AI_CONFIG_FLAG_KEY, user_context, None)
            
            # NEUTRAL SCENARIO: All AI models perform similarly
            # Get model name if available
            model_name = 'unknown'
            if variation and hasattr(variation, 'model') and variation.model:
                model_name = variation.model.get('name', 'unknown')
            
            # All models have similar performance (neutral results)
            # Slight variations to make it realistic but keep results competitive
            
            if 'claude' in model_name.lower():
                # Claude: Slightly better accuracy, slightly higher cost
                accuracy = random.uniform(87, 92)
                source_fidelity = random.uniform(82, 87)
                relevance = random.uniform(85, 90)
                cost = random.uniform(0.25, 0.35)
                negative_feedback_rate = 0.08
            elif 'nova' in model_name.lower():
                # Nova: Similar accuracy, lower cost
                accuracy = random.uniform(86, 91)
                source_fidelity = random.uniform(81, 86)
                relevance = random.uniform(84, 89)
                cost = random.uniform(0.15, 0.25)
                negative_feedback_rate = 0.09
            elif 'gpt' in model_name.lower():
                # GPT: Similar accuracy, moderate cost
                accuracy = random.uniform(86.5, 91.5)
                source_fidelity = random.uniform(81.5, 86.5)
                relevance = random.uniform(84.5, 89.5)
                cost = random.uniform(0.20, 0.30)
                negative_feedback_rate = 0.085
            else:
                # Default: Baseline performance
                accuracy = random.uniform(85, 90)
                source_fidelity = random.uniform(80, 85)
                relevance = random.uniform(83, 88)
                cost = random.uniform(0.18, 0.28)
                negative_feedback_rate = 0.10
            
            # Track all metrics
            client.track(AI_ACCURACY_KEY, user_context, None, accuracy)
            client.track(AI_SOURCE_FIDELITY_KEY, user_context, None, source_fidelity)
            client.track(AI_RELEVANCE_KEY, user_context, None, relevance)
            client.track(AI_COST_KEY, user_context, None, cost)
            
            # Track negative feedback
            if random.random() < negative_feedback_rate:
                client.track(AI_CHATBOT_NEGATIVE_FEEDBACK_KEY, user_context)
            
            # Flush more frequently to prevent event buffer overflow
            if (i + 1) % 50 == 0:
                logging.info(f"Processed {i + 1} users for AI Config experiment")
                client.flush()
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            # Small delay to prevent SDK overload
            time.sleep(0.005)  # 5ms delay = ~200 events/sec
                
        except Exception as e:
            logging.error(f"Error processing user {i}: {str(e)}")
            continue
    
    logging.info("AI Config experiment results generation completed")
    client.flush()
    time.sleep(0.5)  # Wait for final flush to complete

def ai_configs_monitoring_results_generator(client):
    """Monitoring results generator for AI Configs (completion-mode chatbot config)."""
    LD_FLAG_KEY = AI_CONFIG_FLAG_KEY
    NUM_RUNS = 1000
    
    aiclient = LDAIClient(client)
    
    if not client.is_initialized():
        logging.error("Failed to initialize LaunchDarkly client for AI Config monitoring")
        return
    
    logging.info("Starting AI Configs monitoring results generation...")
    
    for i in range(NUM_RUNS):
        try:
            context = generate_user_context()
            config = aiclient.completion_config(LD_FLAG_KEY, context)
            tracker = config.create_tracker()
            
            duration = random.randint(500, 2000)
            time_to_first_token = random.randint(50, duration)
            prompt_tokens = random.randint(20, 100)
            completion_tokens = random.randint(50, 500)
            total_tokens = prompt_tokens + completion_tokens
            tokens = TokenUsage(prompt_tokens, completion_tokens, total_tokens)
            feedback_kind = FeedbackKind.Positive if random.random() < 0.5 else FeedbackKind.Negative
            
            tracker.track_duration(duration)
            tracker.track_tokens(tokens)
            tracker.track_feedback({"kind": feedback_kind})
            tracker.track_time_to_first_token(time_to_first_token)
            
            if random.random() < 0.95:
                tracker.track_success()
            else:
                tracker.track_error()
            
            if (i + 1) % 100 == 0:
                logging.info(f"Processed {i + 1} monitoring events")
                client.flush()
                
        except Exception as e:
            logging.error(f"Error processing monitoring event {i}: {str(e)}")
            continue
    
    logging.info("AI Configs monitoring results generation completed")

def multi_agent_monitoring_results_generator(client):
    """Monitoring results generator for the 5 multi-agent pipeline AI configs.
    
    Uses the proper AI SDK (agent_config + create_tracker) to populate
    the Monitoring tab for each agent config with tokens, duration, TTFT,
    success/error, and feedback metrics.
    """
    NUM_RUNS_PER_AGENT = 2000
    
    aiclient = LDAIClient(client)
    
    if not client.is_initialized():
        logging.error("Failed to initialize LaunchDarkly client for multi-agent monitoring")
        return
    
    logging.info("Starting multi-agent monitoring results generation (using AI SDK tracker)...")
    
    for agent_key in MULTI_AGENT_KEYS:
        profile = MULTI_AGENT_PROFILES[agent_key]
        logging.info(f"  Generating {NUM_RUNS_PER_AGENT} events for {profile['label']} ({agent_key})...")
        
        for i in range(NUM_RUNS_PER_AGENT):
            try:
                context = generate_user_context()
                
                agent_cfg = aiclient.agent_config(agent_key, context)
                tracker = agent_cfg.create_tracker()
                
                dur_min, dur_max = profile["duration_range"]
                duration = random.randint(dur_min, dur_max)
                time_to_first_token = random.randint(50, max(60, duration // 3))
                
                pt_min, pt_max = profile["prompt_tokens_range"]
                ct_min, ct_max = profile["completion_tokens_range"]
                prompt_tokens = random.randint(pt_min, pt_max)
                completion_tokens = random.randint(ct_min, ct_max)
                total_tokens = prompt_tokens + completion_tokens
                
                tracker.track_duration(duration)
                tracker.track_time_to_first_token(time_to_first_token)
                tracker.track_tokens(TokenUsage(prompt_tokens, completion_tokens, total_tokens))
                
                if random.random() < profile["success_rate"]:
                    tracker.track_success()
                else:
                    tracker.track_error()
                
                if random.random() < profile["positive_feedback_rate"]:
                    tracker.track_feedback({"kind": FeedbackKind.Positive})
                else:
                    tracker.track_feedback({"kind": FeedbackKind.Negative})
                
                if (i + 1) % 500 == 0:
                    logging.info(f"    Processed {i + 1}/{NUM_RUNS_PER_AGENT} events for {profile['label']}")
                    client.flush()
                    
            except Exception as e:
                logging.error(f"Error processing multi-agent event for {agent_key}, iteration {i}: {str(e)}")
                continue
        
        client.flush()
        time.sleep(1)
    
    logging.info("Multi-agent monitoring results generation completed (all 5 agents)")

def brand_voice_experiment_results_generator(client):
    """Experiment results generator for Brand Voice Model Comparison.
    
    Uses the AI SDK (agent_config + create_tracker) to generate monitoring
    data, plus client.track() for the experiment-specific custom metrics.
    """
    LD_FEATURE_FLAG_KEY = "ai-config--togglestore-brand-voice"
    NUM_USERS = 3000

    MODEL_PROFILES = {
        "sonnet": {
            "accuracy": (91, 96),
            "source_fidelity": (86, 92),
            "relevance": (90, 96),
            "cost": (0.35, 0.55),
            "negative_feedback_rate": 0.05,
        },
        "nova": {
            "accuracy": (87, 93),
            "source_fidelity": (83, 89),
            "relevance": (86, 92),
            "cost": (0.10, 0.25),
            "negative_feedback_rate": 0.08,
        },
        "gpt": {
            "accuracy": (85, 91),
            "source_fidelity": (81, 87),
            "relevance": (84, 90),
            "cost": (0.15, 0.30),
            "negative_feedback_rate": 0.09,
        },
    }

    DEFAULT_PROFILE = {
        "accuracy": (85, 91),
        "source_fidelity": (80, 86),
        "relevance": (83, 89),
        "cost": (0.20, 0.40),
        "negative_feedback_rate": 0.10,
    }

    aiclient = LDAIClient(client)

    logging.info("Starting Brand Voice model experiment results generation...")

    for i in range(NUM_USERS):
        try:
            user_context = generate_user_context()
            
            agent_cfg = aiclient.agent_config(LD_FEATURE_FLAG_KEY, user_context)
            tracker = agent_cfg.create_tracker()

            model_name = ""
            if agent_cfg.model:
                model_name = (agent_cfg.model.name or "").lower()

            profile = DEFAULT_PROFILE
            for key, prof in MODEL_PROFILES.items():
                if key in model_name:
                    profile = prof
                    break

            accuracy = random.uniform(*profile["accuracy"])
            source_fidelity = random.uniform(*profile["source_fidelity"])
            relevance = random.uniform(*profile["relevance"])
            cost = random.uniform(*profile["cost"])

            # Experiment-level custom metrics
            client.track(AI_ACCURACY_KEY, user_context, None, accuracy)
            client.track(AI_SOURCE_FIDELITY_KEY, user_context, None, source_fidelity)
            client.track(AI_RELEVANCE_KEY, user_context, None, relevance)
            client.track(AI_COST_KEY, user_context, None, cost)

            # Monitoring-level metrics via AI SDK tracker
            duration = random.randint(300, 1500)
            prompt_tokens = random.randint(200, 500)
            completion_tokens = random.randint(150, 600)
            tracker.track_duration(duration)
            tracker.track_tokens(TokenUsage(prompt_tokens, completion_tokens, prompt_tokens + completion_tokens))
            tracker.track_time_to_first_token(random.randint(40, max(50, duration // 4)))
            tracker.track_success()

            if random.random() < profile["negative_feedback_rate"]:
                client.track(AI_CHATBOT_NEGATIVE_FEEDBACK_KEY, user_context)
                tracker.track_feedback({"kind": FeedbackKind.Negative})
            else:
                tracker.track_feedback({"kind": FeedbackKind.Positive})

            if (i + 1) % 500 == 0:
                logging.info(f"Processed {i + 1} users for Brand Voice experiment")
                client.flush()
        except Exception as e:
            logging.error(f"Error processing Brand Voice experiment user {i}: {str(e)}")
            continue
    logging.info("Brand Voice experiment results generation completed")

AGENT_GRAPH_KEY = "togglestore-shopping-pipeline"

SHOPPING_QUESTIONS = [
    "What size should I get in the Toggle Hoodie? I usually wear a medium in Nike.",
    "Can I return the Osmo Sneakers if they don't fit? I bought them last week.",
    "What's the best jacket for cold weather? My budget is around $200.",
    "Do you have the Toggle Backpack in black? The one I saw at the conference.",
    "I need a gift for someone who likes streetwear. What would you recommend?",
    "My order #12345 hasn't arrived yet. It's been 5 days since it shipped.",
    "What material is the Feature Flag Tee made of? Is it pre-shrunk?",
    "Compare the Osmo Sneakers with the Toggle Runners for me.",
    "I want to exchange my Toggle Cap for a different color. How do I do that?",
    "What are the most popular items right now?",
    "Do you offer express shipping? I need something by Friday.",
    "The zipper on my Toggle Hoodie broke after two washes. Can I get a replacement?",
    "What outfit would go well with the Dark Mode joggers?",
    "Are there any upcoming sales or promotions?",
    "I'm a size 10 US in women's. What size Toggle Sneakers should I get?",
    "Can you help me find a professional-looking outfit for a tech conference?",
    "What's the difference between the Toggle Hoodie and the Toggle Pullover?",
    "I received the wrong item in my order. How do I start a return?",
]

TRIAGE_ROUTES = {
    "ai-config--togglestore-product-specialist": 0.35,
    "ai-config--togglestore-order-specialist": 0.25,
    "ai-config--togglestore-style-advisor": 0.30,
}


def _get_tracer():
    """Get an OpenTelemetry tracer for agent graph spans."""
    if not OBSERVABILITY_AVAILABLE:
        return None
    try:
        return trace.get_tracer("togglestore.agent-graph", "1.0.0")
    except Exception:
        return None


AGENT_PROMPTS = {
    "triage": "Classify this customer query into one category: product, order, or style. Query: '{question}'. Reply with just the category.",
    "specialist": "As a shopping assistant, give a one-sentence answer to: '{question}'",
    "brand-voice": "Rewrite this in a friendly brand voice: '{response}'",
}


def _make_llm_call(role, question, response="", model_name=None):
    """Make a small real OpenAI call for trace generation. Returns (text, tokens_dict)."""
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


@contextmanager
def _safe_span(tracer, name, **kwargs):
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


def agent_graph_results_generator(client, num_iterations=500):
    """Generate synthetic agent graph data with OTel traces.
    
    Uses the AI SDK's agent_graph() to resolve the graph, records per-node
    metrics (via config trackers), graph-level metrics (via graph tracker),
    and creates OpenTelemetry spans that become traces in the LD monitoring tab.
    """
    aiclient = LDAIClient(client)
    tracer = _get_tracer()
    
    if not client.is_initialized():
        logging.error("Failed to initialize LaunchDarkly client for agent graph generation")
        return
    
    use_llm = OPENAI_AVAILABLE and bool(os.getenv("OPENAI_API_KEY"))
    max_trace_iterations = 30
    logging.info(f"Starting agent graph results generation ({num_iterations} iterations, traces={'enabled' if tracer else 'disabled'}, llm={'enabled — first ' + str(max_trace_iterations) + ' iterations' if use_llm else 'disabled'})...")
    
    for i in range(num_iterations):
        try:
            context = generate_user_context()
            question = random.choice(SHOPPING_QUESTIONS)
            
            graph = aiclient.agent_graph(AGENT_GRAPH_KEY, context)
            
            if not graph.is_enabled():
                if i == 0:
                    logging.warning(f"Agent graph '{AGENT_GRAPH_KEY}' is disabled — skipping graph generation")
                    return
                continue
            
            graph_tracker = graph.create_tracker()
            root_node = graph.root()
            
            if root_node is None:
                logging.warning("Agent graph has no root node")
                continue
            
            total_tokens_in = 0
            total_tokens_out = 0
            graph_start = time.time()
            
            specialist_key = random.choices(
                list(TRIAGE_ROUTES.keys()),
                weights=list(TRIAGE_ROUTES.values()),
                k=1,
            )[0]
            
            with _safe_span(tracer, "togglestore.agent-pipeline", attributes={
                "gen_ai.system": "togglestore",
                "gen_ai.operation.name": "agent-graph",
                "agent.graph_key": AGENT_GRAPH_KEY,
                "agent.question": question,
            }) as pipeline_span:
            
                # --- Node 1: Triage ---
                triage_key = root_node.get_key()
                triage_model = "unknown"
                try:
                    tc = root_node.get_config()
                    triage_model = tc.model.name if tc.model else "unknown"
                except Exception:
                    pass
                
                make_traces = use_llm and i < max_trace_iterations
                
                with _safe_span(tracer, "agent.triage", attributes={
                    "gen_ai.system": "togglestore",
                    "gen_ai.request.model": triage_model,
                    "agent.name": triage_key,
                    "agent.role": "triage",
                    "feature_flag.key": triage_key,
                    "feature_flag.provider.name": "LaunchDarkly",
                }) as triage_span:
                    triage_config = root_node.get_config()
                    triage_tracker = triage_config.create_tracker()
                    
                    if make_traces:
                        _make_llm_call("triage", question)
                    
                    triage_dur = random.randint(200, 800)
                    triage_prompt = random.randint(50, 150)
                    triage_completion = random.randint(30, 100)
                    
                    triage_tracker.track_duration(triage_dur)
                    triage_tracker.track_tokens(TokenUsage(triage_prompt, triage_completion, triage_prompt + triage_completion))
                    triage_tracker.track_time_to_first_token(random.randint(30, min(80, triage_dur)))
                    triage_tracker.track_success()
                    
                    total_tokens_in += triage_prompt
                    total_tokens_out += triage_completion
                    triage_span.set_attribute("gen_ai.usage.input_tokens", triage_prompt)
                    triage_span.set_attribute("gen_ai.usage.output_tokens", triage_completion)
                    triage_span.set_attribute("agent.duration_ms", triage_dur)
                    triage_span.set_attribute("agent.routed_to", specialist_key)
                
                # --- Node 2: Specialist ---
                specialist_node = graph.get_node(specialist_key)
                spec_profile = MULTI_AGENT_PROFILES.get(specialist_key, MULTI_AGENT_PROFILES["ai-config--togglestore-product-specialist"])
                spec_dur = 0
                
                if specialist_node is not None:
                    spec_model = "unknown"
                    try:
                        sc = specialist_node.get_config()
                        spec_model = sc.model.name if sc.model else "unknown"
                    except Exception:
                        pass
                    
                    with _safe_span(tracer, "agent.specialist", attributes={
                        "gen_ai.system": "togglestore",
                        "gen_ai.request.model": spec_model,
                        "agent.name": specialist_key,
                        "agent.role": "specialist",
                        "feature_flag.key": specialist_key,
                        "feature_flag.provider.name": "LaunchDarkly",
                    }) as spec_span:
                        spec_config = specialist_node.get_config()
                        spec_tracker = spec_config.create_tracker()
                        
                        spec_response = ""
                        if make_traces:
                            resp, _ = _make_llm_call("specialist", question)
                            spec_response = resp or ""
                        
                        dur_min, dur_max = spec_profile["duration_range"]
                        spec_dur = random.randint(dur_min, dur_max)
                        pt_min, pt_max = spec_profile["prompt_tokens_range"]
                        ct_min, ct_max = spec_profile["completion_tokens_range"]
                        spec_prompt = random.randint(pt_min, pt_max)
                        spec_completion = random.randint(ct_min, ct_max)
                        
                        spec_tracker.track_duration(spec_dur)
                        spec_tracker.track_tokens(TokenUsage(spec_prompt, spec_completion, spec_prompt + spec_completion))
                        spec_tracker.track_time_to_first_token(random.randint(40, max(50, spec_dur // 4)))
                        spec_tracker.track_success()
                        
                        total_tokens_in += spec_prompt
                        total_tokens_out += spec_completion
                        graph_tracker.track_handoff_success(triage_key, specialist_key)
                        spec_span.set_attribute("gen_ai.usage.input_tokens", spec_prompt)
                        spec_span.set_attribute("gen_ai.usage.output_tokens", spec_completion)
                        spec_span.set_attribute("agent.duration_ms", spec_dur)
                else:
                    specialist_key = triage_key
                
                # --- Node 3: Brand Voice ---
                brand_key = "ai-config--togglestore-brand-voice"
                brand_node = graph.get_node(brand_key)
                execution_path = [triage_key, specialist_key]
                brand_dur = 0
                
                if brand_node is not None:
                    brand_model = "unknown"
                    try:
                        bc = brand_node.get_config()
                        brand_model = bc.model.name if bc.model else "unknown"
                    except Exception:
                        pass
                    
                    with _safe_span(tracer, "agent.brand-voice", attributes={
                        "gen_ai.system": "togglestore",
                        "gen_ai.request.model": brand_model,
                        "agent.name": brand_key,
                        "agent.role": "brand-voice",
                        "feature_flag.key": brand_key,
                        "feature_flag.provider.name": "LaunchDarkly",
                    }) as brand_span:
                        brand_config = brand_node.get_config()
                        brand_tracker = brand_config.create_tracker()
                        
                        if make_traces:
                            _make_llm_call("brand-voice", question, response=spec_response if specialist_node else "")
                        
                        brand_dur = random.randint(300, 1500)
                        brand_prompt = random.randint(200, 500)
                        brand_completion = random.randint(150, 600)
                        
                        brand_tracker.track_duration(brand_dur)
                        brand_tracker.track_tokens(TokenUsage(brand_prompt, brand_completion, brand_prompt + brand_completion))
                        brand_tracker.track_time_to_first_token(random.randint(30, max(50, brand_dur // 5)))
                        brand_tracker.track_success()
                        
                        if random.random() < 0.78:
                            brand_tracker.track_feedback({"kind": FeedbackKind.Positive})
                        else:
                            brand_tracker.track_feedback({"kind": FeedbackKind.Negative})
                        
                        total_tokens_in += brand_prompt
                        total_tokens_out += brand_completion
                        graph_tracker.track_handoff_success(specialist_key, brand_key)
                        execution_path.append(brand_key)
                        brand_span.set_attribute("gen_ai.usage.input_tokens", brand_prompt)
                        brand_span.set_attribute("gen_ai.usage.output_tokens", brand_completion)
                        brand_span.set_attribute("agent.duration_ms", brand_dur)
                
                # --- Graph-level metrics ---
                graph_duration = int((time.time() - graph_start) * 1000) + triage_dur + spec_dur + brand_dur
                
                graph_tracker.track_total_tokens(TokenUsage(
                    total_tokens_in, total_tokens_out, total_tokens_in + total_tokens_out,
                ))
                graph_tracker.track_invocation_success()
                graph_tracker.track_duration(graph_duration)
                graph_tracker.track_path(execution_path)
                
                pipeline_span.set_attribute("agent.execution_path", " -> ".join(execution_path))
                pipeline_span.set_attribute("gen_ai.usage.input_tokens", total_tokens_in)
                pipeline_span.set_attribute("gen_ai.usage.output_tokens", total_tokens_out)
                pipeline_span.set_attribute("agent.total_duration_ms", graph_duration)
            
            if (i + 1) % 100 == 0:
                logging.info(f"  Agent graph: processed {i + 1}/{num_iterations} iterations")
                _flush_traces()
                client.flush()
                time.sleep(0.2)
            
            time.sleep(0.01)
                
        except Exception as e:
            logging.error(f"Error in agent graph iteration {i}: {str(e)}")
            continue
    
    _flush_traces()
    client.flush()
    time.sleep(1)
    logging.info(f"Agent graph results generation completed ({num_iterations} iterations)")


def shopping_assistant_agent_generator(client):
    """Guarded rollout generator for Shopping Assistant Agent - SUCCESSFUL release"""
    if not client.is_initialized():
        logging.error("LaunchDarkly client is not initialized for Shopping Assistant Agent")
        return
    
    logging.info("Starting guarded release generator for Shopping Assistant Agent (SUCCESS scenario)...")
    
    # Wait for rollout to be ready
    logging.info("Waiting for flag rollout to be ready...")
    if not _wait_for_measured_rollout(SHOPPING_ASSISTANT_AGENT_FLAG_KEY, "Shopping Assistant Agent"):
        return
    
    user_counter = 0
    flush_counter = 0
    status_check_counter = 0
    
    while True:
        # Check rollout status every 500 users
        if status_check_counter >= 500:
            flag_details = get_flag_details(SHOPPING_ASSISTANT_AGENT_FLAG_KEY)
            if not flag_details or not is_measured_rollout(flag_details):
                logging.info("Measured rollout is over. Exiting Shopping Assistant Agent generator.")
                break
            status_check_counter = 0
        
        try:
            user_context = generate_user_context()
            flag_value = client.variation(SHOPPING_ASSISTANT_AGENT_FLAG_KEY, user_context, None)
            
            # SUCCESS SCENARIO: LD AI Model Pro (test variation/true) performs better than LD AI Model Mini (control/false)
            # Determine which model based on variation - check multiple possible fields
            is_pro_model = False
            if flag_value is not None:
                flag_str = str(flag_value).lower()
                # Check if variation key, name, or model contains 'pro'
                if 'pro' in flag_str:
                    is_pro_model = True
                elif 'mini' in flag_str:
                    is_pro_model = False
                else:
                    # Try to access variation attributes if it's an object
                    if hasattr(flag_value, 'key'):
                        variation_key = str(flag_value.key).lower()
                        is_pro_model = 'pro' in variation_key
                    elif hasattr(flag_value, 'name'):
                        variation_name = str(flag_value.name).lower()
                        is_pro_model = 'pro' in variation_name
                    elif isinstance(flag_value, dict):
                        # Check dict keys
                        if 'key' in flag_value:
                            is_pro_model = 'pro' in str(flag_value['key']).lower()
                        elif 'name' in flag_value:
                            is_pro_model = 'pro' in str(flag_value['name']).lower()
                        elif 'model' in flag_value:
                            model_info = flag_value['model']
                            if isinstance(model_info, dict) and 'name' in model_info:
                                is_pro_model = 'pro' in str(model_info['name']).lower()
            
            if is_pro_model:
                # PRO MODEL (True Variation/Test): Excellent performance - 90%+ accuracy, very low negative feedback
                accuracy = random.uniform(90, 98)  # High accuracy (90-98%) - ensures 90%+ minimum
                negative_feedback_rate = 0.015  # Very low negative feedback (1.5%)
            else:
                # MINI MODEL (False Variation/Control): Good baseline - 80+ but below 90%, worse negative feedback
                accuracy = random.uniform(80, 89)  # Moderate accuracy (80-89%) - ensures 80+ but below 90%
                negative_feedback_rate = 0.12  # Higher negative feedback (12%) - worse than pro model
            
            # Track accuracy (numeric metric)
            client.track(SHOPPING_AGENT_ACCURACY_KEY, user_context, None, accuracy)
            
            # Track negative feedback (occurrence metric - lower is better)
            if random.random() < negative_feedback_rate:
                client.track(SHOPPING_AGENT_NEGATIVE_FEEDBACK_KEY, user_context)
            
            user_counter += 1
            flush_counter += 1
            status_check_counter += 1
            
            # Flush events every 200 users to reduce connection pool pressure
            if flush_counter >= 200:
                client.flush()
                flush_counter = 0
                logging.info(f"Flushed shopping assistant events (total users: {user_counter})")
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            time.sleep(0.02)  # 20ms delay to reduce event rate
            
        except Exception as e:
            logging.error(f"Error generating shopping assistant metrics: {str(e)}")
            continue
    
    logging.info(f"Shopping Assistant Agent generator finished. Total users: {user_counter}")

def _flush_traces():
    """Flush all pending OpenTelemetry spans."""
    if not OBSERVABILITY_AVAILABLE:
        return
    try:
        provider = trace.get_tracer_provider()
        if hasattr(provider, "force_flush"):
            provider.force_flush(timeout_millis=10000)
            logging.info("Trace spans flushed")
    except Exception as e:
        logging.debug(f"Failed to flush traces: {e}")


JUDGE_EVAL_QUERIES = [
    "What products do you have under $20?",
    "Can I return the Toggle Float I bought last week?",
    "What size Developer Shoes should I get if I'm usually a 10?",
    "Tell me about the LD Watch",
    "My order hasn't arrived yet",
    "What would look good with the Bucket Hat?",
    "Do you ship internationally?",
    "What's the difference between Toggle Float and Feature Float?",
    "I received the wrong item in my order",
    "Can you recommend a gift for a developer?",
    "How much is the Code & Coffee Mug?",
    "What material are the Feature Flag Socks made of?",
    "I want to exchange my shoes for a different size",
    "What's your best-selling item?",
    "Is the LDVR Headset actually functional?",
]


def judge_evaluation_data_generator(client, num_iterations=30):
    """Generate judge evaluation data by running queries through the SDK's managed model flow.
    Attached judges auto-evaluate and record scores in the Monitoring tab."""
    if not OPENAI_AVAILABLE:
        logging.warning("OpenAI not available — skipping judge evaluation data generation")
        return

    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        logging.warning("OPENAI_API_KEY not set — skipping judge evaluation data generation")
        return

    openai_client = OpenAI(api_key=openai_key)
    aiclient = LDAIClient(client)

    chatbot_key = "ai-config--togglebotchatbot"

    logging.info(f"Generating judge evaluation data ({num_iterations} iterations)...")

    for i in range(num_iterations):
        query = random.choice(JUDGE_EVAL_QUERIES)

        user = random.choice(["user-judge-eval-1", "user-judge-eval-2", "user-judge-eval-3",
                              "user-judge-eval-4", "user-judge-eval-5"])
        context = Context.builder(user).kind("user").set("tier", random.choice(["standard", "platinum"])).build()

        try:
            config = aiclient.config(
                chatbot_key,
                context,
                {},
                {"userInput": query}
            )

            if not config or not config.enabled:
                logging.debug(f"Judge eval iteration {i+1}: config disabled, skipping")
                continue

            tracker = config.create_tracker()

            messages = config.messages if config.messages else []
            if not messages:
                messages = [{"role": "user", "content": query}]

            try:
                response = openai_client.chat.completions.create(
                    model=config.model.get("modelName", "gpt-4o-mini") if config.model else "gpt-4o-mini",
                    messages=messages,
                    max_tokens=200,
                    temperature=0.7,
                )
                output_text = response.choices[0].message.content or ""
                input_tokens = response.usage.prompt_tokens if response.usage else 50
                output_tokens = response.usage.completion_tokens if response.usage else 30

                tracker.track_tokens(TokenUsage(total=input_tokens + output_tokens, input=input_tokens, output=output_tokens))
                tracker.track_success()
                tracker.track_duration(random.uniform(0.8, 3.0))

                if i % 10 == 0:
                    logging.info(f"  Judge eval iteration {i+1}/{num_iterations} — query: {query[:40]}...")

            except Exception as e:
                tracker.track_error()
                logging.debug(f"  Judge eval iteration {i+1} LLM call failed: {e}")

        except Exception as e:
            logging.debug(f"  Judge eval iteration {i+1} config retrieval failed: {e}")

        time.sleep(0.5)

    logging.info(f"Judge evaluation data generation complete ({num_iterations} iterations)")


def generate_results(project_key, api_key):
    """Main function to generate all results (single run)."""
    logging.info(f"Generating results for project {project_key}")
    
    sdk_key = os.getenv("LD_SDK_KEY")
    if not sdk_key:
        logging.error("LD_SDK_KEY not set in environment. Skipping results generation.")
        return
    
    if OBSERVABILITY_AVAILABLE:
        obs_config = ObservabilityConfig(
            service_name="togglestore-results-generator",
        )
        config = Config(
            sdk_key=sdk_key,
            plugins=[ObservabilityPlugin(obs_config)],
            events_max_pending=5000,
            flush_interval=5.0,
        )
        logging.info("Observability plugin enabled (traces will be exported)")
    else:
        config = Config(
            sdk_key=sdk_key,
            events_max_pending=5000,
            flush_interval=5.0,
        )
    
    ldclient.set_config(config)
    client = ldclient.get()
    
    if not client.is_initialized():
        logging.error("Failed to initialize LaunchDarkly client")
        return
    
    try:
        # 0. Seed session:init events to trigger autogenerated error metric creation
        logging.info("Seeding session:init events for autogenerated error metric...")
        for i in range(15):
            ctx = generate_user_context()
            client.track("$ld:telemetry:session:init", ctx)
        client.flush()
        logging.info("Sent 15 session:init events (metric will be created in background)")

        # 1. Evaluate all flags to generate exposure events
        logging.info("=" * 60)
        logging.info("STEP 1: Generating flag evaluations")
        logging.info("=" * 60)
        evaluate_all_flags(client)
        
        # 2. Generate experiment results
        logging.info("=" * 60)
        logging.info("STEP 2: Generating experiment results")
        logging.info("=" * 60)
        
        search_algorithm_experiment_generator(client)
        store_promo_banner_experiment_generator(client)
        ai_config_experiment_generator(client)
        
        logging.info("Experiment results generation completed.")
        
        # 2.5. Generate AI Config monitoring results (chatbot)
        logging.info("=" * 60)
        logging.info("STEP 2.5: Generating AI Config monitoring results")
        logging.info("=" * 60)
        
        ai_configs_monitoring_results_generator(client)
        
        logging.info("AI Config monitoring results generation completed.")
        
        # 2.6. Generate multi-agent pipeline monitoring + experiment results
        logging.info("=" * 60)
        logging.info("STEP 2.6: Generating multi-agent pipeline monitoring results")
        logging.info("=" * 60)
        
        multi_agent_monitoring_results_generator(client)
        brand_voice_experiment_results_generator(client)
        
        logging.info("Multi-agent pipeline results generation completed.")
        
        # 2.7. Generate agent graph data
        logging.info("=" * 60)
        logging.info("STEP 2.7: Generating agent graph results")
        logging.info("=" * 60)
        
        agent_graph_results_generator(client, num_iterations=500)
        
        logging.info("Agent graph results generation completed.")
        
        # 2.8. Generate judge evaluation data
        logging.info("=" * 60)
        logging.info("STEP 2.8: Generating judge evaluation data")
        logging.info("=" * 60)
        
        judge_evaluation_data_generator(client, num_iterations=30)
        
        logging.info("Judge evaluation data generation completed.")
        
        # 2.9. Update inventory sync flag to use autogenerated error metric
        logging.info("=" * 60)
        logging.info("STEP 2.9: Updating inventory sync metric to autogenerated error metric")
        logging.info("=" * 60)
        _upgrade_inventory_sync_metric()
        
        # 3. Generate guarded rollout results
        logging.info("=" * 60)
        logging.info("STEP 3: Generating guarded rollout results")
        logging.info("=" * 60)
        
        payments_thread = threading.Thread(
            target=payments_systems_upgrade_generator,
            args=(client,)
        )
        email_service_thread = threading.Thread(
            target=email_notification_service_upgrade_generator,
            args=(client,)
        )
        shopping_assistant_thread = threading.Thread(
            target=shopping_assistant_agent_generator,
            args=(client,)
        )
        inventory_sync_thread = threading.Thread(
            target=inventory_sync_error_generator,
            args=(client,)
        )

        payments_thread.start()
        email_service_thread.start()
        shopping_assistant_thread.start()
        inventory_sync_thread.start()

        logging.info("Guarded rollout generators are running...")
        logging.info("They will continue until measured rollouts complete.")

        payments_thread.join()
        email_service_thread.join()
        shopping_assistant_thread.join()
        inventory_sync_thread.join()
        
        logging.info("All guarded rollout generators have completed.")
        
        logging.info("=" * 60)
        logging.info("All results generation completed successfully!")
        logging.info("=" * 60)
        
    finally:
        logging.info("Performing final flush to ensure all events are sent...")
        _flush_traces()
        client.flush()
        time.sleep(2)
        client.flush()
        time.sleep(1)
        logging.info("Final flush completed. Closing client...")
        client.close()


def generate_continuous(project_key, api_key, interval_minutes=30):
    """Run AI monitoring + agent graph generation in a continuous loop.
    
    Generates fresh monitoring data for the multi-agent pipeline, brand voice
    experiment, and agent graph on a configurable interval. Ideal for keeping
    demo dashboards populated with recent data without needing a Lambda scheduler.
    
    Usage:
        python LDResultsGenerator.py --continuous [--interval 30]
    """
    sdk_key = os.getenv("LD_SDK_KEY")
    if not sdk_key:
        logging.error("LD_SDK_KEY not set in environment. Exiting.")
        return
    
    logging.info(f"Starting continuous results generation for project {project_key}")
    logging.info(f"Interval: {interval_minutes} minutes between cycles")
    logging.info("Press Ctrl+C to stop\n")
    
    config = Config(
        sdk_key=sdk_key,
        events_max_pending=5000,
        flush_interval=5.0,
    )
    ldclient.set_config(config)
    client = ldclient.get()
    
    if not client.is_initialized():
        logging.error("Failed to initialize LaunchDarkly client")
        return
    
    cycle = 0
    try:
        while True:
            cycle += 1
            logging.info("=" * 60)
            logging.info(f"CONTINUOUS CYCLE {cycle} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logging.info("=" * 60)
            
            try:
                # AI Config chatbot monitoring
                logging.info("[Cycle %d] Generating chatbot monitoring data (200 runs)...", cycle)
                aiclient = LDAIClient(client)
                for i in range(200):
                    try:
                        ctx = generate_user_context()
                        cfg = aiclient.completion_config(AI_CONFIG_FLAG_KEY, ctx)
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
                
                # Multi-agent monitoring
                logging.info("[Cycle %d] Generating multi-agent monitoring data (300/agent)...", cycle)
                for agent_key in MULTI_AGENT_KEYS:
                    profile = MULTI_AGENT_PROFILES[agent_key]
                    for i in range(300):
                        try:
                            ctx = generate_user_context()
                            agent_cfg = aiclient.agent_config(agent_key, ctx)
                            t = agent_cfg.create_tracker()
                            dur_min, dur_max = profile["duration_range"]
                            dur = random.randint(dur_min, dur_max)
                            pt_min, pt_max = profile["prompt_tokens_range"]
                            ct_min, ct_max = profile["completion_tokens_range"]
                            pt = random.randint(pt_min, pt_max)
                            ct = random.randint(ct_min, ct_max)
                            t.track_duration(dur)
                            t.track_tokens(TokenUsage(pt, ct, pt + ct))
                            t.track_time_to_first_token(random.randint(30, max(50, dur // 3)))
                            if random.random() < profile["success_rate"]:
                                t.track_success()
                            else:
                                t.track_error()
                            if random.random() < profile["positive_feedback_rate"]:
                                t.track_feedback({"kind": FeedbackKind.Positive})
                            else:
                                t.track_feedback({"kind": FeedbackKind.Negative})
                        except Exception as e:
                            logging.debug(f"Multi-agent monitoring error ({agent_key}): {e}")
                    client.flush()
                
                # Agent graph
                logging.info("[Cycle %d] Generating agent graph data (100 iterations)...", cycle)
                agent_graph_results_generator(client, num_iterations=100)
                
            except Exception as e:
                logging.error(f"Error in cycle {cycle}: {str(e)}")
            
            client.flush()
            time.sleep(2)
            
            logging.info(f"[Cycle {cycle}] Complete. Sleeping {interval_minutes} minutes until next cycle...")
            time.sleep(interval_minutes * 60)
            
    except KeyboardInterrupt:
        logging.info("\nContinuous generation stopped by user.")
    finally:
        logging.info("Performing final flush...")
        client.flush()
        time.sleep(2)
        client.close()
        logging.info("Done.")


if __name__ == "__main__":
    PROJECT_KEY = os.getenv("LD_PROJECT_KEY")
    LD_API_KEY = os.getenv("LD_API_KEY")
    
    if not PROJECT_KEY or not LD_API_KEY:
        logging.error("LD_PROJECT_KEY and LD_API_KEY must be set in environment")
        exit(1)
    
    if "--continuous" in sys.argv:
        interval = 30
        if "--interval" in sys.argv:
            try:
                idx = sys.argv.index("--interval")
                interval = int(sys.argv[idx + 1])
            except (IndexError, ValueError):
                logging.warning("Invalid --interval value, using default 30 minutes")
        generate_continuous(PROJECT_KEY, LD_API_KEY, interval_minutes=interval)
    else:
        generate_results(PROJECT_KEY, LD_API_KEY)

