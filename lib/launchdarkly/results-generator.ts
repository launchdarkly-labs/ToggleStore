/**
 * LaunchDarkly Results Generator
 * 
 * Generates metrics, experiment results, and errors for LaunchDarkly analytics.
 * This replaces the Python script functionality within the web app.
 */

import { getFlagValue } from "./server"
import { trackMetric } from "./metrics-server"
import { recordErrorToLD } from "./observability-server"
import { logger } from "@/lib/logger"
import type { LDContext } from "@launchdarkly/node-server-sdk"

// Flag keys
const SEARCH_ALGORITHM_FLAG_KEY = "searchAlgorithm"
const STORE_PROMO_FLAG_KEY = "storePromoBanner"
const AI_CONFIG_FLAG_KEY = "ai-config--togglebotchatbot"
const SHOPPING_ASSISTANT_AGENT_FLAG_KEY = "ai-config--togglestore-shopping-assistant-agent"

// Search algorithm experiment metrics
const SEARCH_STARTED_KEY = "search-started"
const ADD_TO_CART_FROM_SEARCH_KEY = "add-to-cart-from-search"
const CART_TOTAL_KEY = "cart-total"

// Store promo banner experiment metrics
const STORE_PROMO_CART_TOTAL_KEY = "cart-total"

// AI Config experiment metrics
const AI_ACCURACY_KEY = "ai-accuracy"
const AI_SOURCE_FIDELITY_KEY = "ai-source-fidelity"
const AI_RELEVANCE_KEY = "ai-relevance"
const AI_COST_KEY = "ai-cost"
const AI_CHATBOT_NEGATIVE_FEEDBACK_KEY = "ai-chatbot-negative-feedback"

// Shopping Assistant Agent metrics
const SHOPPING_AGENT_ACCURACY_KEY = "shopping-agent-accuracy"
const SHOPPING_AGENT_NEGATIVE_FEEDBACK_KEY = "shopping-agent-negative-feedback"

/**
 * Generate a random user context for flag evaluation
 */
function generateUserContext(): LDContext {
  const userKey = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`
  return {
    kind: "user",
    key: userKey,
    name: `Test User ${userKey.substring(5, 13)}`,
    email: `test-${userKey.substring(5, 13)}@example.com`,
    tier: Math.random() > 0.5 ? "Platinum" : "Standard",
    role: ["Developer", "Beta", "Standard"][Math.floor(Math.random() * 3)],
    location: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"][
      Math.floor(Math.random() * 5)
    ],
    device: ["mobile", "desktop", "tablet"][Math.floor(Math.random() * 3)],
    operating_system: ["windows", "macos", "ios", "android"][
      Math.floor(Math.random() * 4)
    ],
  }
}

/**
 * Generate search algorithm experiment results
 */
async function generateSearchAlgorithmResults(numUsers: number = 3000): Promise<void> {
  logger.info(`Generating search algorithm experiment results for ${numUsers} users`)

  for (let i = 0; i < numUsers; i++) {
    try {
      const context = generateUserContext()
      const variation = await getFlagValue(SEARCH_ALGORITHM_FLAG_KEY, context, "control")

      // Track search started
      await trackMetric(SEARCH_STARTED_KEY, context)

      // featured-list variation should WIN - better conversion rates
      let addToCartProbability: number
      let avgCartTotal: number

      if (variation === "featured-list") {
        // WINNER: Higher engagement and conversion
        addToCartProbability = 0.65 // 65% add to cart from search
        avgCartTotal = Math.floor(Math.random() * (800 - 150 + 1)) + 150 // Higher cart values
      } else if (variation === "simple-search") {
        // Simple Search: Moderate performance
        addToCartProbability = 0.55 // 55% add to cart
        avgCartTotal = Math.floor(Math.random() * (600 - 100 + 1)) + 100
      } else {
        // Control/False: Baseline performance
        addToCartProbability = 0.45 // 45% add to cart
        avgCartTotal = Math.floor(Math.random() * (500 - 80 + 1)) + 80
      }

      // Track add to cart from search
      if (Math.random() < addToCartProbability) {
        await trackMetric(ADD_TO_CART_FROM_SEARCH_KEY, context)
        // Track cart total
        await trackMetric(CART_TOTAL_KEY, context, avgCartTotal)
      }

      if ((i + 1) % 100 === 0) {
        logger.info(`Processed ${i + 1}/${numUsers} users for Search Algorithm experiment`)
      }
    } catch (error) {
      logger.error(
        `Error generating search algorithm result for user ${i}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  logger.info("Search Algorithm experiment results generation completed")
}

/**
 * Generate store promo banner experiment results
 */
async function generateStorePromoBannerResults(numUsers: number = 3000): Promise<void> {
  logger.info(`Generating store promo banner experiment results for ${numUsers} users`)

  for (let i = 0; i < numUsers; i++) {
    try {
      const context = generateUserContext()
      const variation = await getFlagValue(
        STORE_PROMO_FLAG_KEY,
        context,
        "Flash Sale"
      )

      // NEUTRAL SCENARIO: All variations perform similarly (no clear winner)
      let storeAccessRate: number
      let itemAddRate: number
      let cartAccessRate: number
      let checkoutRate: number
      let avgCartTotal: number

      if (variation === "Flash Sale") {
        // Slight edge but not significant
        storeAccessRate = 0.75
        itemAddRate = 0.60
        cartAccessRate = 0.55
        checkoutRate = 0.48
        avgCartTotal = Math.floor(Math.random() * (600 - 100 + 1)) + 100
      } else if (variation === "Free Shipping") {
        // Similar performance
        storeAccessRate = 0.73
        itemAddRate = 0.58
        cartAccessRate = 0.53
        checkoutRate = 0.46
        avgCartTotal = Math.floor(Math.random() * (580 - 95 + 1)) + 95
      } else {
        // "20 Percent Off" - Similar performance
        storeAccessRate = 0.74
        itemAddRate = 0.59
        cartAccessRate = 0.54
        checkoutRate = 0.47
        avgCartTotal = Math.floor(Math.random() * (590 - 98 + 1)) + 98
      }

      // Simulate funnel progression
      if (Math.random() < storeAccessRate) {
        await trackMetric("store-accessed", context)
        if (Math.random() < itemAddRate) {
          await trackMetric("add-to-cart", context)
          if (Math.random() < cartAccessRate) {
            await trackMetric("cart-accessed", context)
            if (Math.random() < checkoutRate) {
              await trackMetric("checkout-complete", context)
              // Track cart total
              await trackMetric(STORE_PROMO_CART_TOTAL_KEY, context, avgCartTotal)
            }
          }
        }
      }

      if ((i + 1) % 100 === 0) {
        logger.info(`Processed ${i + 1}/${numUsers} users for Store Promo Banner experiment`)
      }
    } catch (error) {
      logger.error(
        `Error generating store promo banner result for user ${i}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  logger.info("Store Promo Banner experiment results generation completed")
}

/**
 * Generate AI Config experiment results
 */
async function generateAIConfigResults(numUsers: number = 3000): Promise<void> {
  logger.info(`Generating AI Config experiment results for ${numUsers} users`)

  for (let i = 0; i < numUsers; i++) {
    try {
      const context = generateUserContext()
      const variation = await getFlagValue(AI_CONFIG_FLAG_KEY, context, null)

      // NEUTRAL SCENARIO: All AI models perform similarly
      // Get model name if available
      let modelName = "unknown"
      if (variation && typeof variation === "object" && variation !== null) {
        const variationObj = variation as Record<string, unknown>
        if (variationObj.model && typeof variationObj.model === "object") {
          const model = variationObj.model as Record<string, unknown>
          modelName = (model.name as string) || "unknown"
        }
      }

      // All models have similar performance (neutral results)
      let accuracy: number
      let sourceFidelity: number
      let relevance: number
      let cost: number
      let negativeFeedbackRate: number

      if (modelName.toLowerCase().includes("claude")) {
        // Claude: Slightly better accuracy, slightly higher cost
        accuracy = 87 + Math.random() * 5 // 87-92
        sourceFidelity = 82 + Math.random() * 5 // 82-87
        relevance = 85 + Math.random() * 5 // 85-90
        cost = 0.25 + Math.random() * 0.1 // 0.25-0.35
        negativeFeedbackRate = 0.08
      } else if (modelName.toLowerCase().includes("nova")) {
        // Nova: Similar accuracy, lower cost
        accuracy = 86 + Math.random() * 5 // 86-91
        sourceFidelity = 81 + Math.random() * 5 // 81-86
        relevance = 84 + Math.random() * 5 // 84-89
        cost = 0.15 + Math.random() * 0.1 // 0.15-0.25
        negativeFeedbackRate = 0.09
      } else if (modelName.toLowerCase().includes("gpt")) {
        // GPT: Similar accuracy, moderate cost
        accuracy = 86.5 + Math.random() * 5 // 86.5-91.5
        sourceFidelity = 81.5 + Math.random() * 5 // 81.5-86.5
        relevance = 84.5 + Math.random() * 5 // 84.5-89.5
        cost = 0.20 + Math.random() * 0.1 // 0.20-0.30
        negativeFeedbackRate = 0.085
      } else {
        // Default: Baseline performance
        accuracy = 85 + Math.random() * 5 // 85-90
        sourceFidelity = 80 + Math.random() * 5 // 80-85
        relevance = 83 + Math.random() * 5 // 83-88
        cost = 0.18 + Math.random() * 0.1 // 0.18-0.28
        negativeFeedbackRate = 0.10
      }

      // Track all metrics
      await trackMetric(AI_ACCURACY_KEY, context, accuracy)
      await trackMetric(AI_SOURCE_FIDELITY_KEY, context, sourceFidelity)
      await trackMetric(AI_RELEVANCE_KEY, context, relevance)
      await trackMetric(AI_COST_KEY, context, cost)

      // Track negative feedback
      if (Math.random() < negativeFeedbackRate) {
        await trackMetric(AI_CHATBOT_NEGATIVE_FEEDBACK_KEY, context)
      }

      if ((i + 1) % 100 === 0) {
        logger.info(`Processed ${i + 1}/${numUsers} users for AI Config experiment`)
      }
    } catch (error) {
      logger.error(
        `Error generating AI Config result for user ${i}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  logger.info("AI Config experiment results generation completed")
}

/**
 * Generate AI monitoring results
 * Simulates AI Config usage tracking
 */
async function generateAIMonitoringResults(numRuns: number = 1000): Promise<void> {
  logger.info(`Generating AI monitoring results for ${numRuns} runs`)

  for (let i = 0; i < numRuns; i++) {
    try {
      const context = generateUserContext()
      await getFlagValue(AI_CONFIG_FLAG_KEY, context, null)

      // Simulate AI interaction metrics
      const duration = Math.floor(Math.random() * (2000 - 500 + 1)) + 500 // 500-2000ms
      const timeToFirstToken = Math.floor(Math.random() * (duration - 50 + 1)) + 50
      const promptTokens = Math.floor(Math.random() * (100 - 20 + 1)) + 20
      const completionTokens = Math.floor(Math.random() * (500 - 50 + 1)) + 50
      const totalTokens = promptTokens + completionTokens

      // Track duration (as a custom metric if available)
      // Note: AI monitoring typically uses the AI SDK's built-in tracking
      // For now, we'll track these as custom metrics
      await trackMetric("ai-duration", context, duration)
      await trackMetric("ai-time-to-first-token", context, timeToFirstToken)
      await trackMetric("ai-prompt-tokens", context, promptTokens)
      await trackMetric("ai-completion-tokens", context, completionTokens)
      await trackMetric("ai-total-tokens", context, totalTokens)

      // Track success/error
      if (Math.random() < 0.95) {
        await trackMetric("ai-success", context)
      } else {
        await trackMetric("ai-error", context)
        // Generate an error for observability
        const error = new Error(`AI request failed: Token limit exceeded`)
        await recordErrorToLD(
          error,
          `AI monitoring error: Request ${i} failed`,
          {
            component: "AIMonitoring",
            runId: String(i),
            duration: String(duration),
            totalTokens: String(totalTokens),
          }
        )
      }

      // Track feedback
      const feedbackKind = Math.random() < 0.5 ? "positive" : "negative"
      await trackMetric(`ai-feedback-${feedbackKind}`, context)

      if ((i + 1) % 100 === 0) {
        logger.info(`Processed ${i + 1}/${numRuns} AI monitoring events`)
      }
    } catch (error) {
      logger.error(
        `Error generating AI monitoring result for run ${i}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  logger.info("AI monitoring results generation completed")
}

/**
 * Generate shopping assistant agent results
 */
async function generateShoppingAssistantResults(numUsers: number = 1000): Promise<void> {
  logger.info(`Generating shopping assistant agent results for ${numUsers} users`)

  for (let i = 0; i < numUsers; i++) {
    try {
      const context = generateUserContext()
      const variation = await getFlagValue(
        SHOPPING_ASSISTANT_AGENT_FLAG_KEY,
        context,
        null
      )

      // SUCCESS SCENARIO: Pro model performs better than Mini
      let isProModel = false
      if (variation !== null && variation !== undefined) {
        const variationStr = String(variation).toLowerCase()
        if (variationStr.includes("pro")) {
          isProModel = true
        } else if (variationStr.includes("mini")) {
          isProModel = false
        } else if (typeof variation === "object" && variation !== null) {
          const variationObj = variation as Record<string, unknown>
          if (variationObj.key && String(variationObj.key).toLowerCase().includes("pro")) {
            isProModel = true
          } else if (variationObj.name && String(variationObj.name).toLowerCase().includes("pro")) {
            isProModel = true
          } else if (variationObj.model && typeof variationObj.model === "object") {
            const model = variationObj.model as Record<string, unknown>
            if (model.name && String(model.name).toLowerCase().includes("pro")) {
              isProModel = true
            }
          }
        }
      }

      let accuracy: number
      let negativeFeedbackRate: number

      if (isProModel) {
        // PRO MODEL: Excellent performance - 90%+ accuracy, very low negative feedback
        accuracy = 90 + Math.random() * 8 // 90-98%
        negativeFeedbackRate = 0.015 // 1.5%
      } else {
        // MINI MODEL: Good baseline - 80+ but below 90%, worse negative feedback
        accuracy = 80 + Math.random() * 9 // 80-89%
        negativeFeedbackRate = 0.12 // 12%
      }

      // Track accuracy
      await trackMetric(SHOPPING_AGENT_ACCURACY_KEY, context, accuracy)

      // Track negative feedback
      if (Math.random() < negativeFeedbackRate) {
        await trackMetric(SHOPPING_AGENT_NEGATIVE_FEEDBACK_KEY, context)
      }

      if ((i + 1) % 100 === 0) {
        logger.info(`Processed ${i + 1}/${numUsers} users for Shopping Assistant Agent`)
      }
    } catch (error) {
      logger.error(
        `Error generating shopping assistant result for user ${i}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  logger.info("Shopping Assistant Agent results generation completed")
}

/**
 * Generate errors and logs for observability
 */
async function generateErrorsAndLogs(numErrors: number = 50): Promise<void> {
  logger.info(`Generating ${numErrors} errors and logs for observability`)

  const errorTypes = [
    {
      name: "ProductLoadError",
      message: "Failed to load product data",
      component: "ProductCard",
    },
    {
      name: "APIConnectionError",
      message: "Failed to connect to product API",
      component: "ProductAPI",
    },
    {
      name: "CartUpdateError",
      message: "Failed to update shopping cart",
      component: "Cart",
    },
    {
      name: "PaymentProcessingError",
      message: "Payment processing failed",
      component: "Payment",
    },
    {
      name: "SearchQueryError",
      message: "Search query execution failed",
      component: "Search",
    },
    {
      name: "ChatbotResponseError",
      message: "Chatbot failed to generate response",
      component: "Chatbot",
    },
  ]

  for (let i = 0; i < numErrors; i++) {
    try {
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)]
      const error = new Error(
        `${errorType.message}: Invalid response format from ${errorType.component.toLowerCase()} service.`
      )
      ;(error as Error & { code?: string }).code = errorType.name

      await recordErrorToLD(
        error,
        `${errorType.component} error: ${errorType.message}`,
        {
          component: errorType.component,
          errorId: `error-${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          severity: Math.random() > 0.7 ? "high" : "medium",
        },
        errorType.component
      )

      if ((i + 1) % 10 === 0) {
        logger.info(`Generated ${i + 1}/${numErrors} errors`)
      }
    } catch (error) {
      logger.error(
        `Error generating error log ${i}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  logger.info("Errors and logs generation completed")
}

/**
 * Main function to generate all results
 */
export async function generateAllResults(options?: {
  searchAlgorithmUsers?: number
  storePromoUsers?: number
  aiConfigUsers?: number
  aiMonitoringRuns?: number
  shoppingAssistantUsers?: number
  numErrors?: number
}): Promise<{
  success: boolean
  results: {
    searchAlgorithm?: { users: number; status: string }
    storePromo?: { users: number; status: string }
    aiConfig?: { users: number; status: string }
    aiMonitoring?: { runs: number; status: string }
    shoppingAssistant?: { users: number; status: string }
    errors?: { count: number; status: string }
  }
  error?: string
}> {
  const startTime = Date.now()
  logger.info("=".repeat(60))
  logger.info("Starting LaunchDarkly results generation")
  logger.info("=".repeat(60))

  const results: {
    searchAlgorithm?: { users: number; status: string }
    storePromo?: { users: number; status: string }
    aiConfig?: { users: number; status: string }
    aiMonitoring?: { runs: number; status: string }
    shoppingAssistant?: { users: number; status: string }
    errors?: { count: number; status: string }
  } = {}

  try {
    // Generate experiment results
    logger.info("STEP 1: Generating experiment results")
    logger.info("-".repeat(60))

    try {
      const searchUsers = options?.searchAlgorithmUsers || 3000
      await generateSearchAlgorithmResults(searchUsers)
      results.searchAlgorithm = { users: searchUsers, status: "completed" }
    } catch (error) {
      logger.error(
        "Failed to generate search algorithm results",
        error instanceof Error ? error : new Error(String(error))
      )
      results.searchAlgorithm = { users: 0, status: "failed" }
    }

    try {
      const storePromoUsers = options?.storePromoUsers || 3000
      await generateStorePromoBannerResults(storePromoUsers)
      results.storePromo = { users: storePromoUsers, status: "completed" }
    } catch (error) {
      logger.error(
        "Failed to generate store promo banner results",
        error instanceof Error ? error : new Error(String(error))
      )
      results.storePromo = { users: 0, status: "failed" }
    }

    try {
      const aiConfigUsers = options?.aiConfigUsers || 3000
      await generateAIConfigResults(aiConfigUsers)
      results.aiConfig = { users: aiConfigUsers, status: "completed" }
    } catch (error) {
      logger.error(
        "Failed to generate AI Config results",
        error instanceof Error ? error : new Error(String(error))
      )
      results.aiConfig = { users: 0, status: "failed" }
    }

    // Generate AI monitoring results
    logger.info("STEP 2: Generating AI monitoring results")
    logger.info("-".repeat(60))

    try {
      const aiMonitoringRuns = options?.aiMonitoringRuns || 1000
      await generateAIMonitoringResults(aiMonitoringRuns)
      results.aiMonitoring = { runs: aiMonitoringRuns, status: "completed" }
    } catch (error) {
      logger.error(
        "Failed to generate AI monitoring results",
        error instanceof Error ? error : new Error(String(error))
      )
      results.aiMonitoring = { runs: 0, status: "failed" }
    }

    // Generate shopping assistant results
    try {
      const shoppingUsers = options?.shoppingAssistantUsers || 1000
      await generateShoppingAssistantResults(shoppingUsers)
      results.shoppingAssistant = { users: shoppingUsers, status: "completed" }
    } catch (error) {
      logger.error(
        "Failed to generate shopping assistant results",
        error instanceof Error ? error : new Error(String(error))
      )
      results.shoppingAssistant = { users: 0, status: "failed" }
    }

    // Generate errors and logs
    logger.info("STEP 3: Generating errors and logs")
    logger.info("-".repeat(60))

    try {
      const numErrors = options?.numErrors || 50
      await generateErrorsAndLogs(numErrors)
      results.errors = { count: numErrors, status: "completed" }
    } catch (error) {
      logger.error(
        "Failed to generate errors and logs",
        error instanceof Error ? error : new Error(String(error))
      )
      results.errors = { count: 0, status: "failed" }
    }

    const duration = Date.now() - startTime
    logger.info("=".repeat(60))
    logger.info(`All results generation completed in ${duration}ms`)
    logger.info("=".repeat(60))

    return {
      success: true,
      results,
    }
  } catch (error) {
    logger.error(
      "Failed to generate results",
      error instanceof Error ? error : new Error(String(error))
    )
    return {
      success: false,
      results,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

