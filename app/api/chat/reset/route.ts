import { NextRequest, NextResponse } from "next/server"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { v4 as uuidv4 } from "uuid"

interface LaunchDarklyContext {
  kind: string
  key: string
  ai?: {
    key: string
    fallback: boolean
  }
  [key: string]: unknown
}

export async function POST(request: NextRequest) {
  try {
    // Get LaunchDarkly context from cookie
    const cookieHeader = request.headers.get("cookie") || ""
    const contextMatch = cookieHeader.match(new RegExp(`${LD_CONTEXT_COOKIE_KEY}=([^;]+)`))
    const clientSideContext = contextMatch
      ? JSON.parse(decodeURIComponent(contextMatch[1]))
      : {}

    // Build context and force reset ai.fallback to false
    if (clientSideContext && typeof clientSideContext === 'object' && Object.keys(clientSideContext).length > 0) {
      const ctx = clientSideContext as LaunchDarklyContext
      if (!ctx.kind) {
        ctx.kind = "user"
      }
      if (!ctx.key && ctx.kind === "user") {
        ctx.key = uuidv4()
      }
      
      // Force reset fallback to false
      ctx.ai = {
        key: "ai-context",
        fallback: false
      }
    }

    // We don't need to do anything else on the server since the client will 
    // update its local state and the context will be updated in the next request
    // But we could potentially update the cookie here if needed
    
    return NextResponse.json({ success: true, message: "AI context reset successfully" })

  } catch {
    return NextResponse.json(
      { error: "Failed to reset AI context" },
      { status: 500 }
    )
  }
}

