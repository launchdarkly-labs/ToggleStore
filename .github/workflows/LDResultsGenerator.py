import os
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
from datetime import datetime, timedelta

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
DATABASE_FLAG_KEY = "databaseUpgrade"
SEARCH_ALGORITHM_FLAG_KEY = "searchAlgorithm"
STORE_PROMO_FLAG_KEY = "storePromoBanner"
AI_CONFIG_FLAG_KEY = "ai-config--togglebotchatbot"

# Payment metrics
PAYMENT_SUCCESS_RATE_KEY = "payment-success-rate"
PAYMENT_LATENCY_KEY = "payment-latency"
PAYMENT_ERROR_RATE_KEY = "payment-error-rate"

# Database metrics
DATABASE_ERROR_RATE_KEY = "database-error-rate"
DATABASE_LATENCY_KEY = "database-latency"
DATABASE_THROUGHPUT_KEY = "database-throughput"

# Search algorithm experiment metrics
SEARCH_STARTED_KEY = "search-started"
ADD_TO_CART_FROM_SEARCH_KEY = "add-to-cart-from-search"
CART_TOTAL_KEY = "cart-total"

# Store promo banner experiment metrics
STORE_PURCHASES_KEY = "store-purchases"  # Metric group
STORE_PROMO_CART_TOTAL_KEY = "cart-total"

# AI Config experiment metrics
AI_ACCURACY_KEY = "ai-accuracy"
AI_SOURCE_FIDELITY_KEY = "ai-source-fidelity"
AI_RELEVANCE_KEY = "ai-relevance"
AI_COST_KEY = "ai-cost"
AI_CHATBOT_NEGATIVE_FEEDBACK_KEY = "ai-chatbot-negative-feedback"

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
    logging.info("Flag evaluation finished.")

def payments_systems_upgrade_generator(client, stop_event):
    """Guarded rollout generator for payments systems upgrade - SUCCESSFUL release"""
    if not client.is_initialized():
        logging.error("LaunchDarkly client is not initialized for Payments Systems Upgrade")
        return
    
    logging.info("Starting guarded release generator for Payments Systems Upgrade (SUCCESS scenario)...")
    
    # Wait for rollout to be ready
    logging.info("Waiting for flag rollout to be ready...")
    max_retries = 6
    retry_count = 0
    rollout_ready = False
    
    while retry_count < max_retries and not rollout_ready:
        time.sleep(5)
        flag_details = get_flag_details(PAYMENTS_FLAG_KEY)
        if flag_details and is_measured_rollout(flag_details):
            rollout_ready = True
            logging.info("✅ Payments Systems Upgrade rollout is ready!")
        else:
            retry_count += 1
            logging.info(f"Rollout not ready yet, retrying... ({retry_count}/{max_retries})")
    
    if not rollout_ready:
        logging.error("Payments Systems Upgrade rollout failed to initialize after 30 seconds. Exiting.")
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
                stop_event.set()
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

def database_upgrade_generator(client, stop_event):
    """Guarded rollout generator for database upgrade - FAILED release with rollback"""
    if not client.is_initialized():
        logging.error("LaunchDarkly client is not initialized for Database Upgrade")
        return
    
    logging.info("Starting guarded release generator for Database Upgrade (FAILURE scenario with rollback)...")
    
    # Wait for rollout to be ready
    logging.info("Waiting for flag rollout to be ready...")
    max_retries = 6
    retry_count = 0
    rollout_ready = False
    
    while retry_count < max_retries and not rollout_ready:
        time.sleep(5)
        flag_details = get_flag_details(DATABASE_FLAG_KEY)
        if flag_details and is_measured_rollout(flag_details):
            rollout_ready = True
            logging.info("✅ Database Upgrade rollout is ready!")
        else:
            retry_count += 1
            logging.info(f"Rollout not ready yet, retrying... ({retry_count}/{max_retries})")
    
    if not rollout_ready:
        logging.error("Database Upgrade rollout failed to initialize after 30 seconds. Exiting.")
        return
    
    user_counter = 0
    flush_counter = 0
    status_check_counter = 0
    alert_triggered = False
    
    while True:
        # Check rollout status every 500 users
        if status_check_counter >= 500:
            flag_details = get_flag_details(DATABASE_FLAG_KEY)
            if not flag_details or not is_measured_rollout(flag_details):
                logging.info("Measured rollout is over. Exiting Database Upgrade generator.")
                stop_event.set()
                break
            status_check_counter = 0
        
        try:
            user_context = generate_user_context()
            flag_value = client.variation(DATABASE_FLAG_KEY, user_context, False)
            
            # FAILURE SCENARIO: New version (True) performs aggressively worse - triggers rollback
            if flag_value:
                # NEW VERSION (True): Catastrophic performance - will aggressively trigger rollback
                error_rate = 25.0  # 25% error rate (catastrophically high)
                latency = 3500     # 3500ms latency (extremely slow)
                throughput = 30     # 30 ops/sec (very low throughput)
                
                # Trigger alert when first user gets bad version
                if not alert_triggered:
                    logging.warning(f"🚨 Database rollback triggered at user {user_counter} - high error rate detected!")
                    alert_triggered = True
            else:
                # LEGACY VERSION (False): Excellent baseline performance
                error_rate = 0.2   # 0.2% error rate (very low)
                latency = 80       # 80ms latency (fast)
                throughput = 600   # 600 ops/sec (excellent throughput)
            
            # Track error rate
            if random.random() < (error_rate / 100):
                client.track(DATABASE_ERROR_RATE_KEY, user_context)
            
            # Track latency with tight variance for consistency
            latency_variance = 50 if flag_value else 5  # Tight variance: ±50ms for bad, ±5ms for good
            latency_value = int(latency + random.uniform(-latency_variance, latency_variance))
            client.track(DATABASE_LATENCY_KEY, user_context, None, latency_value)
            
            # Track throughput with tight variance for consistency
            throughput_variance = 5 if flag_value else 10  # Tight variance: ±5 ops/sec for bad, ±10 ops/sec for good
            throughput_value = int(throughput + random.uniform(-throughput_variance, throughput_variance))
            client.track(DATABASE_THROUGHPUT_KEY, user_context, None, throughput_value)
            
            user_counter += 1
            flush_counter += 1
            status_check_counter += 1
            
            # Flush events every 200 users to reduce connection pool pressure
            if flush_counter >= 200:
                client.flush()
                flush_counter = 0
                logging.info(f"Flushed database events (total users: {user_counter})")
                time.sleep(0.1)  # Small delay after flush to allow connections to close
            
            time.sleep(0.02)  # 20ms delay to reduce event rate
            
        except Exception as e:
            logging.error(f"Error generating database metrics: {str(e)}")
            continue
    
    logging.info(f"Database Upgrade generator finished. Total users: {user_counter}")

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
            
            if (i + 1) % 100 == 0:
                logging.info(f"Processed {i + 1} users for Search Algorithm experiment")
                client.flush()
                
        except Exception as e:
            logging.error(f"Error processing user {i}: {str(e)}")
            continue
    
    logging.info("Search Algorithm experiment results generation completed")
    client.flush()

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
                            client.track(STORE_PROMO_CART_TOTAL_KEY, user_context, None, avg_cart_total)
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
            
            if (i + 1) % 100 == 0:
                logging.info(f"Processed {i + 1} users for Store Promo Banner experiment")
                client.flush()
                
        except Exception as e:
            logging.error(f"Error processing user {i}: {str(e)}")
            continue
    
    logging.info("Store Promo Banner experiment results generation completed")
    client.flush()

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
            
            if (i + 1) % 100 == 0:
                logging.info(f"Processed {i + 1} users for AI Config experiment")
                client.flush()
                
        except Exception as e:
            logging.error(f"Error processing user {i}: {str(e)}")
            continue
    
    logging.info("AI Config experiment results generation completed")
    client.flush()

def generate_results(project_key, api_key):
    """Main function to generate all results"""
    logging.info(f"Generating results for project {project_key}")
    
    sdk_key = os.getenv("LD_SDK_KEY")
    if not sdk_key:
        logging.error("LD_SDK_KEY not set in environment. Skipping results generation.")
        return
    
    # Configure SDK with larger event buffer to reduce connection pool pressure
    config = Config(
        sdk_key=sdk_key,
        events_max_pending=5000  # Increase pending events buffer to batch more events
    )
    ldclient.set_config(config)
    client = ldclient.get()
    
    if not client.is_initialized():
        logging.error("Failed to initialize LaunchDarkly client")
        return
    
    try:
        # 1. Evaluate all flags to generate exposure events
        logging.info("=" * 60)
        logging.info("STEP 1: Generating flag evaluations")
        logging.info("=" * 60)
        evaluate_all_flags(client)
        
        # 2. Generate guarded rollout results
        logging.info("=" * 60)
        logging.info("STEP 2: Generating guarded rollout results")
        logging.info("=" * 60)
        
        payments_stop_event = threading.Event()
        database_stop_event = threading.Event()
        
        payments_thread = threading.Thread(
            target=payments_systems_upgrade_generator,
            args=(client, payments_stop_event)
        )
        database_thread = threading.Thread(
            target=database_upgrade_generator,
            args=(client, database_stop_event)
        )
        
        payments_thread.start()
        database_thread.start()
        
        logging.info("Guarded rollout generators are running...")
        logging.info("They will continue until measured rollouts complete.")
        
        # Wait for both generators to complete
        payments_thread.join()
        database_thread.join()
        
        logging.info("All guarded rollout generators have completed.")
        
        # 3. Generate experiment results
        logging.info("=" * 60)
        logging.info("STEP 3: Generating experiment results")
        logging.info("=" * 60)
        
        search_algorithm_experiment_generator(client)
        store_promo_banner_experiment_generator(client)
        ai_config_experiment_generator(client)
        
        logging.info("=" * 60)
        logging.info("All results generation completed successfully!")
        logging.info("=" * 60)
        
    finally:
        client.flush()
        client.close()

if __name__ == "__main__":
    PROJECT_KEY = os.getenv("LD_PROJECT_KEY")
    LD_API_KEY = os.getenv("LD_API_KEY")
    
    if not PROJECT_KEY or not LD_API_KEY:
        logging.error("LD_PROJECT_KEY and LD_API_KEY must be set in environment")
        exit(1)
    
    generate_results(PROJECT_KEY, LD_API_KEY)

