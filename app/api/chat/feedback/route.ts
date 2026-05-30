import { NextRequest } from "next/server"
import { getLDServerClient } from "@/lib/launchdarkly/server"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { initAi, LDFeedbackKind } from "@launchdarkly/server-sdk-ai"
import { v4 as uuidv4 } from "uuid"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const contextMatch = cookieHeader.match(
      new RegExp(`${LD_CONTEXT_COOKIE_KEY}=([^;]+)`)
    )
    const clientSideContext = contextMatch
      ? JSON.parse(decodeURIComponent(contextMatch[1]))
      : {}

    const ldClient = await getLDServerClient()
    const aiClient = initAi(ldClient)

    const context =
      clientSideContext && Object.keys(clientSideContext).length > 0
        ? clientSideContext
        : { kind: "user", key: uuidv4() }

    const body = await request.json()
    const { feedback, aiConfigKey, resumptionToken } = body

    if (!feedback || !aiConfigKey) {
      return new Response(
        JSON.stringify({ error: "feedback and aiConfigKey are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    let feedbackKind: { kind: LDFeedbackKind } | undefined
    if (feedback === "positive") {
      feedbackKind = { kind: LDFeedbackKind.Positive }
    } else if (feedback === "negative") {
      feedbackKind = { kind: LDFeedbackKind.Negative }
    }

    if (feedbackKind) {
      if (resumptionToken) {
        const tracker = aiClient.createTracker(resumptionToken, context)
        tracker.trackFeedback(feedbackKind)
      } else {
        const aiConfig = await aiClient.config(aiConfigKey, context, {}, {})
        const tracker = aiConfig.createTracker()
        tracker.trackFeedback(feedbackKind)
      }
    }

    return new Response(
      JSON.stringify({ message: "Feedback recorded" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    logger.error(
      "Error in chatbot feedback",
      error instanceof Error ? error : new Error(String(error)),
      {
        endpoint: "/api/chat/feedback",
        component: "chatbot-feedback",
      }
    )
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
