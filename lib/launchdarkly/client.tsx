"use client"

import React, { useEffect, useState, ReactNode, createContext, useContext } from "react"
import { asyncWithLDProvider, useLDClient, useFlags } from "launchdarkly-react-client-sdk"
import { setCookie } from "cookies-next"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { v4 as uuidv4 } from "uuid"
import { logger } from "@/lib/logger"


/**
 * Context to track LaunchDarkly initialization status
 */
interface LaunchDarklyContextValue {
  isInitialized: boolean
  isInitializing: boolean
  error: Error | null
}

const LaunchDarklyContext = createContext<LaunchDarklyContextValue>({
  isInitialized: false,
  isInitializing: true,
  error: null,
})

/**
 * LaunchDarkly Provider Component
 * Wraps the application to provide LaunchDarkly context with multi-context support
 * Includes device detection, observability, and session replay
 */
interface LaunchDarklyProviderProps {
  children: ReactNode
  user?: {
    key: string
    email?: string
    name?: string
    [key: string]: string | number | boolean | undefined
  }
}

export function LaunchDarklyProvider({ children, user }: LaunchDarklyProviderProps) {
  const [LDProvider, setLDProvider] = useState<
    (({ children }: { children: ReactNode }) => React.ReactElement) | null
  >(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const clientSideID = process.env.NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID

  useEffect(() => {
    // Only run in browser (not during SSR)
    if (typeof window === "undefined") {
      return
    }

    // Initialize LaunchDarkly immediately on application start
    const initializeLDProvider = async () => {
      setIsInitializing(true)
      setError(null)

      if (!clientSideID) {
        console.warn(
          "NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID not found. Feature flags will use default values."
        )
        setIsInitializing(false)
        setIsInitialized(false)
        return
      }


      // Dynamically import browser-specific modules
      const [
        { initTelemetry, inspectors },
        Observability,
        SessionReplay,
        deviceDetect,
      ] = await Promise.all([
        import("@launchdarkly/browser-telemetry"),
        import("@launchdarkly/observability").then((m) => m.default),
        import("@launchdarkly/session-replay").then((m) => m.default),
        import("react-device-detect"),
      ])

      // Detect device and OS information
      const { isAndroid, isIOS, isBrowser, isMobile, isMacOs, isWindows } = deviceDetect
      const operatingSystem = isAndroid
        ? "Android"
        : isIOS
          ? "iOS"
          : isWindows
            ? "Windows"
            : isMacOs
              ? "macOS"
              : ""
      const device = isMobile ? "Mobile" : isBrowser ? "Desktop" : ""

      // Generate a unique key for anonymous users
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone


      const anonymousUserContext = {
        kind: 'user',
        anonymous: true,
        key: uuidv4()
      };

      // Build multi-context with user, device, location, experience, and audience
      const context = {
        kind: 'multi',
        user: anonymousUserContext,
        device: {
          key: device || "unknown",
          name: device || "Unknown Device",
          operating_system: operatingSystem,
          platform: device,
        },
        location: {
          key: timeZone,
          name: timeZone,
          timeZone: timeZone,
          country: "US", // Default, can be enhanced with geolocation
        },
        experience: {
          key: "togglestore",
          name: "ToggleStore",
          application: "togglestore",
        }
      }

      // Store context in cookie for persistence
      try {
        setCookie(LD_CONTEXT_COOKIE_KEY, JSON.stringify(context), {
          path: "/",
          maxAge: 60 * 60 * 24 * 365, // 1 year
        })
      } catch (error) {
        logger.warn("Failed to set LaunchDarkly context cookie", {
          component: "LaunchDarklyProvider",
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Initialize telemetry first (before provider)
      try {
        initTelemetry()
      } catch (error) {
        logger.warn("Failed to initialize LaunchDarkly telemetry", {
          component: "LaunchDarklyProvider",
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Initialize LaunchDarkly provider with plugins
      try {
        const Provider = await asyncWithLDProvider({
          clientSideID: clientSideID,
          reactOptions: {
            useCamelCaseFlagKeys: false,
          },
          options: {
            application: {
              id: "togglestore",
            },
            inspectors: inspectors(),
            eventCapacity: 1000,
            privateAttributes: ["email", "name"],
            plugins: [
              new Observability({
                serviceName: process.env.NEXT_PUBLIC_PROJECT_KEY+"-session-replay",
                version: process.env.npm_package_version || "development",
                tracingOrigins: true,
                networkRecording: {
                  enabled: true,
                  recordHeadersAndBody: true,
                  urlBlocklist: [],
                },
              }),
              new SessionReplay({
                serviceName: process.env.NEXT_PUBLIC_PROJECT_KEY+"-session-replay",
                privacySetting: "none",
                tracingOrigins: true,
                contextFriendlyName: (ctx) => {
                  // Build a unique readable key for session replay context
                  // Prefer user, device, location keys if present ("user:<userkey>-device:<devkey>-loc:<lockey>")
                  // Fallback to ctx.key or 'anonymous'
                  const userKey =
                    typeof ctx === "object" && "user" in ctx && ctx.user && typeof ctx.user === "object" && "key" in ctx.user
                      ? String(ctx.user.key)
                      : undefined
                  const deviceKey =
                    typeof ctx === "object" && "device" in ctx && ctx.device && typeof ctx.device === "object" && "key" in ctx.device
                      ? String(ctx.device.key)
                      : undefined
                  const locationKey =
                    typeof ctx === "object" && "location" in ctx && ctx.location && typeof ctx.location === "object" && "key" in ctx.location
                      ? String(ctx.location.key)
                      : undefined
                  if (userKey || deviceKey || locationKey) {
                    return [
                      userKey ? `user:${userKey}` : null,
                      deviceKey ? `device:${deviceKey}` : null,
                      locationKey ? `loc:${locationKey}` : null,
                    ]
                      .filter(Boolean)
                      .join("-")
                  }
                  // Fall back to root context key
                  return typeof ctx === "object" && "key" in ctx && ctx.key ? String(ctx.key) : "anonymous"
                }
              }),
            ],
          },
          context: context,
        })

        setLDProvider(() => Provider)
        setIsInitialized(true)
        setIsInitializing(false)
      } catch (error) {
        const initError = error instanceof Error ? error : new Error("Unknown initialization error")
        
        // Log error for structured logging
        logger.error(
          "LaunchDarkly Client: Failed to initialize provider",
          initError,
          {
            component: "LaunchDarklyProvider",
            clientSideID: clientSideID?.substring(0, 8) + "...",
          }
        )
        
        setError(initError)
        setIsInitializing(false)
        setIsInitialized(false)
        
        // Fallback to rendering children without provider
        const FallbackProvider = ({ children }: { children: ReactNode }) => <>{children}</>
        FallbackProvider.displayName = "FallbackProvider"
        setLDProvider(() => FallbackProvider)
        
        // Throw error for LaunchDarkly observability to track
        // Note: This is caught by the component's error handling, so it won't break the app
        throw initError
      }
    }

    // Initialize immediately when component mounts (client-side only)
    // Wrap in catch to handle any errors that propagate from initializeLDProvider
    initializeLDProvider().catch(() => {
      // Errors are already logged and handled in initializeLDProvider
      // This catch prevents unhandled promise rejections
      // The error is still thrown for LaunchDarkly observability tracking
    })
  }, [clientSideID, user])

  // Provide initialization context to children
  const contextValue: LaunchDarklyContextValue = {
    isInitialized,
    isInitializing,
    error,
  }

  // Render children with or without LaunchDarkly provider
  // This ensures the app doesn't break if LaunchDarkly fails to initialize
  if (!LDProvider) {
    return (
      <LaunchDarklyContext.Provider value={contextValue}>
        {children}
      </LaunchDarklyContext.Provider>
    )
  }

  return (
    <LaunchDarklyContext.Provider value={contextValue}>
      <LDProvider>{children}</LDProvider>
    </LaunchDarklyContext.Provider>
  )
}

/**
 * Hook to get a specific feature flag value
 * @param flagKey - The feature flag key
 * @param defaultValue - The default value if flag is not found
 */
export function useFlag<T = boolean>(flagKey: string, defaultValue: T): T {
  const flags = useFlags()
  return flags[flagKey] !== undefined ? flags[flagKey] : defaultValue
}

/**
 * Hook to get all feature flags
 */
export function useAllFlags() {
  return useFlags()
}

/**
 * Hook to get the LaunchDarkly client instance
 * Useful for manual flag evaluation or tracking custom events
 */
export { useLDClient }

/**
 * Hook to check LaunchDarkly initialization status
 * Useful for showing loading states or handling initialization errors
 */
export function useLaunchDarklyStatus() {
  return useContext(LaunchDarklyContext)
}

