/**
 * LaunchDarkly Server-Side Metrics Tracking Utilities
 * 
 * Provides helper functions for tracking custom events and metrics
 * to LaunchDarkly from server-side code.
 */

import { getLDServerClient } from "./server"
import { logger } from "@/lib/logger"
import type { LDContext } from "@launchdarkly/node-server-sdk"

/**
 * Track a metric on the server side
 * @param eventKey - The event key/name
 * @param context - The LaunchDarkly context (user, device, etc.)
 * @param metricValue - Optional numeric value for the metric
 */
export async function trackMetric(
  eventKey: string,
  context: LDContext,
  metricValue?: number
): Promise<void> {
  try {
    const client = await getLDServerClient()
    
    // Track event without data object, only metricValue if provided
    if (metricValue !== undefined) {
      await client.track(eventKey, context, undefined, metricValue)
    } else {
      await client.track(eventKey, context)
    }
  } catch (error) {
    logger.error(
      `Failed to track server metric "${eventKey}"`,
      error instanceof Error ? error : new Error(String(error)),
      {
        component: "metrics-server",
        eventKey,
        hasMetricValue: metricValue !== undefined,
      }
    )
  }
}

