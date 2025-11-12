/**
 * LaunchDarkly Metrics Tracking Utilities
 * 
 * Provides helper functions for tracking custom events and metrics
 * to LaunchDarkly for analytics and feature flag impact measurement.
 */

"use client"

import { useLDClient } from "launchdarkly-react-client-sdk"

/**
 * Hook to track metrics on the client side
 * @param eventKey - The event key/name
 * @param metricValue - Optional numeric value for the metric
 */
export function useTrackMetric() {
  const ldClient = useLDClient()

  return (eventKey: string, metricValue?: number) => {
    if (!ldClient) {
      console.warn(`[Metrics] LaunchDarkly client not available. Event "${eventKey}" not tracked.`)
      return
    }

    try {
      // Track event without data object, only metricValue if provided
      if (metricValue !== undefined) {
        ldClient.track(eventKey, undefined, metricValue)
        console.log(`[Metrics] Tracked event "${eventKey}" with value ${metricValue}`)
      } else {
        ldClient.track(eventKey)
        console.log(`[Metrics] Tracked event "${eventKey}"`)
      }
    } catch (error) {
      console.error(`[Metrics] Failed to track event "${eventKey}":`, error)
    }
  }
}

