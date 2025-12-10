/**
 * API Route for LaunchDarkly Results Generation
 * 
 * Generates metrics, experiment results, and errors for LaunchDarkly analytics.
 * Can be called manually via POST request.
 */

import { NextRequest, NextResponse } from "next/server"
import { generateAllResults } from "@/lib/launchdarkly/results-generator"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    
    const {
      searchAlgorithmUsers = 3000,
      storePromoUsers = 3000,
      aiConfigUsers = 3000,
      aiMonitoringRuns = 1000,
      shoppingAssistantUsers = 1000,
      numErrors = 50,
    } = body

    logger.info("Results generation API called", {
      searchAlgorithmUsers,
      storePromoUsers,
      aiConfigUsers,
      aiMonitoringRuns,
      shoppingAssistantUsers,
      numErrors,
    })

    const result = await generateAllResults({
      searchAlgorithmUsers: Number(searchAlgorithmUsers),
      storePromoUsers: Number(storePromoUsers),
      aiConfigUsers: Number(aiConfigUsers),
      aiMonitoringRuns: Number(aiMonitoringRuns),
      shoppingAssistantUsers: Number(shoppingAssistantUsers),
      numErrors: Number(numErrors),
    })

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: "Results generation completed successfully",
          results: result.results,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Results generation completed with errors",
          results: result.results,
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error(
      "Failed to generate results via API",
      error instanceof Error ? error : new Error(String(error))
    )

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate results",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Allow GET requests for easy testing
  try {
    logger.info("Results generation API called via GET")

    const result = await generateAllResults({
      searchAlgorithmUsers: 100, // Smaller default for GET requests
      storePromoUsers: 100,
      aiConfigUsers: 100,
      aiMonitoringRuns: 50,
      shoppingAssistantUsers: 50,
      numErrors: 10,
    })

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: "Results generation completed successfully",
          results: result.results,
          note: "GET requests use smaller default values. Use POST for full generation.",
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Results generation completed with errors",
          results: result.results,
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error(
      "Failed to generate results via API",
      error instanceof Error ? error : new Error(String(error))
    )

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate results",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

