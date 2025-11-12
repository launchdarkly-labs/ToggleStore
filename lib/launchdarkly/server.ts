import { init, LDClient, LDOptions, LDContext, LDFlagsState } from "@launchdarkly/node-server-sdk"
import { Observability } from "@launchdarkly/observability-node"
import { logger } from "@/lib/logger"

let ldClient: LDClient | null = null

/**
 * Get or initialize the LaunchDarkly server SDK client
 * Includes observability plugin for monitoring and tracing
 */
export async function getServerClient(sdkKey: string, options?: LDOptions): Promise<LDClient> {
  if (!ldClient) {
    logger.info("LaunchDarkly Server: Starting initialization", {
      sdkKeyPrefix: sdkKey?.substring(0, 8) + "...",
    })
    
    const observabilityOptions = {
      serviceName: "togglestore",
      serviceVersion: process.env.npm_package_version || "development",
      environment: process.env.NODE_ENV || "development",
    }

    logger.info("LaunchDarkly Server: Configuring observability", {
      serviceName: observabilityOptions.serviceName,
      serviceVersion: observabilityOptions.serviceVersion,
      environment: observabilityOptions.environment,
    })

    const mergedOptions: LDOptions = {
      ...options,
      plugins: [...(options?.plugins || []), new Observability(observabilityOptions)],
    }

    logger.debug("LaunchDarkly Server: Initializing SDK with plugins")
    ldClient = await init(sdkKey, mergedOptions)
    logger.debug("LaunchDarkly Server: Waiting for initialization")
  }

  await ldClient.waitForInitialization()
  logger.info("LaunchDarkly Server: Successfully initialized and ready to use feature flags")
  return ldClient
}

/**
 * Get or initialize the LaunchDarkly server SDK client
 * This is the main function to use in your application
 */
export async function getLDServerClient(): Promise<LDClient> {
  const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY

  if (!sdkKey) {
    logger.warn("LaunchDarkly Server: LAUNCHDARKLY_SDK_KEY not found. Feature flags will use default values.", {
      component: "getLDServerClient",
    })
    // Return a mock client that always returns default values
    return {
      variation: async <T>(key: string, context: unknown, defaultValue: T): Promise<T> => defaultValue,
      close: async () => {},
      waitForInitialization: async () => {},
      allFlagsState: async () => ({}),
    } as unknown as LDClient
  }

  return await getServerClient(sdkKey)
}

/**
 * Get a feature flag value for a given context
 * @param flagKey - The feature flag key
 * @param context - The LaunchDarkly context (user, organization, etc.)
 * @param defaultValue - The default value if flag evaluation fails
 */
export async function getFlagValue<T>(
  flagKey: string,
  context: LDContext,
  defaultValue: T
): Promise<T> {
  try {
    const client = await getLDServerClient()
    return await client.variation(flagKey, context, defaultValue)
  } catch (error) {
    logger.error(
      `Error evaluating flag ${flagKey}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        flagKey,
        component: "getFlagValue",
      }
    )
    return defaultValue
  }
}

/**
 * Get multiple feature flag values at once
 */
export async function getAllFlags(context: LDContext): Promise<LDFlagsState> {
  try {
    const client = await getLDServerClient()
    return await client.allFlagsState(context)
  } catch (error) {
    logger.error(
      "Error getting all flags",
      error instanceof Error ? error : new Error(String(error)),
      {
        component: "getAllFlags",
      }
    )
    // Return empty flags state on error
    const client = await getLDServerClient()
    return await client.allFlagsState(context)
  }
}

/**
 * Close the LaunchDarkly client (cleanup)
 */
export async function closeLDClient(): Promise<void> {
  if (ldClient) {
    await ldClient.close()
    ldClient = null
  }
}

