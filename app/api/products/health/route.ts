import { NextRequest } from "next/server"
import { getFlagValue } from "@/lib/launchdarkly/server"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability-server"
import { v4 as uuidv4 } from "uuid"

interface LaunchDarklyContext {
  kind: string
  key: string
  anonymous?: boolean
  [key: string]: unknown
}

export const dynamic = "force-dynamic"

/**
 * Product API Health Check Route
 * Simulates backend errors when apiRelease flag is enabled
 * Errors are tracked by LaunchDarkly observability
 */
export async function GET(request: NextRequest) {
  let apiReleaseEnabled = false
  
  try {
    // Get LaunchDarkly context from cookie
    const cookieHeader = request.headers.get("cookie") || ""
    const contextMatch = cookieHeader.match(new RegExp(`${LD_CONTEXT_COOKIE_KEY}=([^;]+)`))
    const clientSideContext = contextMatch
      ? JSON.parse(decodeURIComponent(contextMatch[1]))
      : {}

    // Build context from client-side context or create anonymous context
    let context: LaunchDarklyContext = clientSideContext?.user || clientSideContext || {
      kind: "user",
      key: uuidv4(),
      anonymous: true,
    }

    // If context is anonymous, replace with a new context with unique key
    if (context.anonymous === true) {
      context = {
        kind: "user",
        key: `user-${uuidv4()}`,
      }
    }

    // Check the apiRelease feature flag using server SDK
    apiReleaseEnabled = await getFlagValue("apiRelease", context, false)

    if (apiReleaseEnabled) {
      // Simulate various backend errors that LaunchDarkly observability will track
      const errorTypes = [
        {
          type: "DatabaseConnectionError",
          label: "Database Error",
          message: "Failed to connect to product database",
          code: "DB_CONNECTION_FAILED",
        },
        {
          type: "InvalidResponseFormat",
          label: "Backend Error",
          message: "Backend returned invalid response format",
          code: "INVALID_RESPONSE",
        },
        {
          type: "ServiceUnavailable",
          label: "Service Error",
          message: "Product API endpoint returned 500 error",
          code: "SERVICE_UNAVAILABLE",
        },
        {
          type: "TimeoutError",
          label: "Timeout Error",
          message: "Request timeout waiting for product service",
          code: "REQUEST_TIMEOUT",
        },
        {
          type: "DataParsingError",
          label: "Parse Error",
          message: "Failed to parse product data from backend",
          code: "PARSE_ERROR",
        },
      ]

      // Randomly select an error type
      const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)]
      
      // Create error object with distinct label per error kind
      const error = new Error(`${randomError.label}: ${randomError.message}`)
      ;(error as Error & { code?: string; errorType?: string }).code = randomError.code
      ;(error as Error & { code?: string; errorType?: string }).errorType = randomError.type
      
      // Log the error for structured logging
      logger.error(
        `Product API error: ${randomError.message}`,
        error,
        {
          errorType: randomError.type,
          errorCode: randomError.code,
          flagEnabled: true,
          endpoint: "/api/products/health",
        }
      )
      
      // Record error to LaunchDarkly observability
      await recordErrorToLD(
        error,
        `Product API error: ${randomError.message}`,
        {
          component: "ProductAPIHealth",
          errorType: randomError.type,
          errorCode: randomError.code,
          flagEnabled: true,
          endpoint: "/api/products/health",
        }
      )
      
      // Throw the error - LaunchDarkly observability will also track this automatically
      throw error
    }

    // Normal response when flag is disabled
    return new Response(
      JSON.stringify({
        status: "healthy",
        message: "Product API is operational",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    // LaunchDarkly observability will automatically track these errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    const errorCode = (error as Error & { code?: string })?.code || "UNKNOWN_ERROR"
    const statusCode = (error as Error & { statusCode?: number })?.statusCode || 500
    
    const errorObj = error instanceof Error ? error : new Error(errorMessage)
    ;(errorObj as Error & { code?: string; statusCode?: number }).code = errorCode
    ;(errorObj as Error & { code?: string; statusCode?: number }).statusCode = statusCode
    
    // Log the error with structured context
    logger.error(
      "Product API health check failed",
      errorObj,
      {
        endpoint: "/api/products/health",
        errorCode,
        statusCode,
        flagEnabled: apiReleaseEnabled,
      }
    )
    
    // Record error to LaunchDarkly observability
    await recordErrorToLD(
      errorObj,
      "Product API health check failed",
      {
        component: "ProductAPIHealth",
        endpoint: "/api/products/health",
        errorCode,
        statusCode,
        flagEnabled: apiReleaseEnabled,
      }
    )

    return new Response(
      JSON.stringify({
        status: "error",
        error: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString(),
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

