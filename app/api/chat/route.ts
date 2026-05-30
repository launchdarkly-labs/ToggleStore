import { NextRequest } from "next/server"
import { getLDServerClient } from "@/lib/launchdarkly/server"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { initAi, LDTokenUsage } from "@launchdarkly/server-sdk-ai"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability-server"
import { v4 as uuidv4 } from "uuid"
import products from "@/data/products.json"
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime"
import { runMultiAgentPipeline } from "@/lib/multi-agent"

interface LaunchDarklyContext {
  kind: string
  key: string
  anonymous?: boolean
  [key: string]: unknown
}

interface ChatMessage {
  role: string
  content: string
  id?: string
}

interface CartItemInput {
  product?: {
    id?: string
    name?: string
    price?: number
  }
  productId?: string
  productName?: string
  quantity?: number
  price?: number
  selectedSize?: string
}

// TypeScript interface for Bedrock message format
interface BedrockMessage {
  role: "user" | "assistant"
  content: Array<{ text: string }>
}

/**
 * Check if a model name is a Bedrock model
 */
function isBedrockModel(modelName: string): boolean {
  const bedrockPatterns = [
    "anthropic.claude",
    "amazon.titan",
    "amazon.nova",
    "meta.llama",
    "cohere.command",
    "ai21.jurassic",
    "stability.stable-diffusion",
    "mistral.mistral",
    "deepseek.deepseek",
  ]
  // Also check for region prefixes like "us." which indicate Bedrock cross-region inference
  return (
    modelName.startsWith("us.") ||
    bedrockPatterns.some((pattern) => modelName.includes(pattern))
  )
}

/**
 * Map AI config messages to Bedrock conversation format
 * Note: Bedrock doesn't support 'system' role in messages array - system messages go in separate 'system' parameter
 */
function mapToBedrockMessages(
  messages: Array<{ role: string; content: string }>
): BedrockMessage[] {
  return messages
    .filter((m) => m.role !== "system") // Filter out system messages - they go separately
    .map((item) => ({
      role: (item.role === "assistant" ? "assistant" : "user") as
        | "user"
        | "assistant",
      content: [{ text: item.content }],
    }))
}

/**
 * Extract system messages for Bedrock's system parameter
 */
function extractSystemMessages(
  messages: Array<{ role: string; content: string }>
): Array<{ text: string }> {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => ({ text: m.content }))
}

/**
 * Chat API Route with LaunchDarkly AI SDK Integration
 * Supports real-time model switching via AI Config
 * AI Config Key: ai-config--togglebotchatbot
 */
export async function POST(request: NextRequest) {
  // Initialize Bedrock client
  // Note: Credentials are NOT explicitly set - the AWS SDK uses its default credential provider chain
  // In EKS, this automatically uses Pod Identity to get temporary credentials from the IAM role
  const region =
    process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-west-2"
  const bedrockClient = new BedrockRuntimeClient({
    region,
    // Credentials are automatically provided by EKS Pod Identity or local AWS config
  })

  try {
    const body = await request.json()
    const {
      userInput,
      chatHistory = [],
      aiConfigKey = "ai-config--togglebotchatbot",
      cartDetails = null,
      productDetails = null,
    } = body

    if (!userInput || typeof userInput !== "string") {
      return new Response(
        JSON.stringify({ error: "userInput is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get LaunchDarkly context from cookie
    const cookieHeader = request.headers.get("cookie") || ""
    const contextMatch = cookieHeader.match(
      new RegExp(`${LD_CONTEXT_COOKIE_KEY}=([^;]+)`)
    )
    const clientSideContext = contextMatch
      ? JSON.parse(decodeURIComponent(contextMatch[1]))
      : {}

    // Build context for LaunchDarkly
    // Preserve the full context structure (including multi-context) so template variables work:
    // - {{ ldctx.user.tier }} - Account Tier
    // - {{ ldctx.user.name }} - User Name
    // - {{ ldctx.location }} - City/Location
    let context: LaunchDarklyContext

    if (
      clientSideContext &&
      typeof clientSideContext === "object" &&
      Object.keys(clientSideContext).length > 0
    ) {
      // Use the full context structure as-is to preserve multi-context and all attributes
      // Ensure it has at least a kind and key for LaunchDarkly SDK compatibility
      const ctx = clientSideContext as LaunchDarklyContext
      if (!ctx.kind) {
        ctx.kind = "user"
      }
      if (!ctx.key && ctx.kind === "user") {
        ctx.key = uuidv4()
      }
      context = ctx
    } else {
      // Create anonymous context
      context = {
        kind: "user",
        key: uuidv4(),
        anonymous: true,
      }
    }

    // If context is anonymous, replace with a new context with unique key
    if (context.anonymous === true && context.kind === "user") {
      context = {
        kind: "user",
        key: `user-${uuidv4()}`,
      }
    }

    // Get LaunchDarkly server client
    const ldClient = await getLDServerClient()

    // Initialize AI client
    const aiClient = initAi(ldClient)

    // Prepare product details - use provided productDetails or load from JSON
    // Format products for AI context (simplified structure with key info)
    const formattedProducts =
      productDetails ||
      products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description,
        stock: product.stock,
        sizes: product.sizes || [],
        tags: product.tags || [],
      }))

    // Prepare cart details - format for AI context if provided
    const formattedCartDetails = cartDetails
      ? {
          items: Array.isArray(cartDetails.items)
            ? cartDetails.items.map((item: CartItemInput) => ({
                productId: item.product?.id || item.productId,
                productName: item.product?.name || item.productName,
                quantity: item.quantity || 0,
                price: item.product?.price || item.price,
                selectedSize: item.selectedSize,
              }))
            : [],
          subtotal: cartDetails.subtotal || 0,
          itemCount:
            cartDetails.itemCount ||
            (Array.isArray(cartDetails.items) ? cartDetails.items.length : 0),
        }
      : null

    // ── Multi-Agent Pipeline ──
    // When the default AI Model Experiment chatbot is used and the triage agent
    // is enabled, route through the multi-agent pipeline instead of single-model.
    if (aiConfigKey === "ai-config--togglebotchatbot") {
      const triageEnabled = await ldClient.variation(
        "ai-config--togglestore-triage",
        context,
        null
      )

      if (triageEnabled !== null) {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const pipelineResult = await runMultiAgentPipeline(
                {
                  userInput,
                  customerContext: {},
                  chatHistory: chatHistory as Array<{
                    role: string
                    content: string
                  }>,
                  cartDetails: formattedCartDetails,
                  ldContext: context,
                },
                (status: string) => {
                  const statusData = JSON.stringify({ status, done: false })
                  controller.enqueue(
                    encoder.encode(`data: ${statusData}\n\n`)
                  )
                }
              )

              // Stream the final response word by word for smooth UX
              const words = pipelineResult.finalResponse.split(" ")
              for (let i = 0; i < words.length; i++) {
                const chunk = (i > 0 ? " " : "") + words[i]
                const chunkData = JSON.stringify({ chunk, done: false })
                controller.enqueue(
                  encoder.encode(`data: ${chunkData}\n\n`)
                )
                await new Promise((resolve) => setTimeout(resolve, 20))
              }

              // Try to extract product data from response
              let productData:
                | { productId?: string; productName?: string; selectedSize?: string }
                | undefined

              const readyKeywords = ["ready", "add to cart", "selected", "here is", "here's"]
              const isReady = readyKeywords.some((kw) =>
                pipelineResult.finalResponse.toLowerCase().includes(kw)
              )
              if (isReady) {
                for (const product of formattedProducts) {
                  if (
                    pipelineResult.finalResponse
                      .toLowerCase()
                      .includes(product.name.toLowerCase())
                  ) {
                    productData = {
                      productId: product.id,
                      productName: product.name,
                    }
                    break
                  }
                }
              }

              const totalTokens = {
                input:
                  pipelineResult.triageResult.tokens.input +
                  pipelineResult.specialistResult.tokens.input +
                  pipelineResult.brandVoiceResult.tokens.input,
                output:
                  pipelineResult.triageResult.tokens.output +
                  pipelineResult.specialistResult.tokens.output +
                  pipelineResult.brandVoiceResult.tokens.output,
                total:
                  pipelineResult.triageResult.tokens.total +
                  pipelineResult.specialistResult.tokens.total +
                  pipelineResult.brandVoiceResult.tokens.total,
              }

              const finalData = JSON.stringify({
                response: pipelineResult.finalResponse,
                modelName: `Pipeline: ${pipelineResult.specialistResult.modelName}`,
                modelType: "multi-agent",
                enabled: true,
                timing: {
                  timeToFirstToken: pipelineResult.triageResult.durationMs,
                  totalTime: pipelineResult.totalDurationMs,
                },
                tokens: totalTokens,
                productData,
                pipeline: {
                  category: pipelineResult.triageCategory,
                  triageModel: pipelineResult.triageResult.modelName,
                  specialistModel: pipelineResult.specialistResult.modelName,
                  brandVoiceModel: pipelineResult.brandVoiceResult.modelName,
                },
                done: true,
              })

              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
              controller.close()
            } catch (error) {
              const errorObj =
                error instanceof Error ? error : new Error(String(error))

              logger.error("Multi-agent pipeline error", errorObj, {
                endpoint: "/api/chat",
                component: "multi-agent-pipeline",
              })

              await recordErrorToLD(
                errorObj,
                "Multi-agent pipeline error",
                { component: "MultiAgentPipeline", endpoint: "/api/chat" }
              )

              const errorData = JSON.stringify({
                error: errorObj.message,
                done: true,
              })
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }
    }

    // ── Single-Model Fallback (original behavior) ──
    const templateVariables = {
      userInput: userInput,
      chatHistory: chatHistory,
      products_list: formattedProducts,
    }

    const aiConfig = await aiClient.config(
      aiConfigKey,
      context,
      {},
      templateVariables
    )

    // Check if AI config is enabled
    // If disabled, check if there's a static response to return
    if (aiConfig.enabled === false) {
      // Check if there's a static response (fallback) - check various possible properties
      const aiConfigAny = aiConfig as unknown as Record<string, unknown>
      const staticResponse =
        (typeof aiConfigAny.response === "string"
          ? aiConfigAny.response
          : undefined) ||
        (typeof aiConfigAny.staticResponse === "string"
          ? aiConfigAny.staticResponse
          : undefined) ||
        (typeof aiConfigAny.fallback === "string"
          ? aiConfigAny.fallback
          : undefined)

      if (staticResponse && typeof staticResponse === "string") {
        // Return static response as streaming
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            // Stream the static response word by word for smooth UX
            const words = staticResponse.split(" ")
            for (let i = 0; i < words.length; i++) {
              const chunk = (i > 0 ? " " : "") + words[i]
              const data = JSON.stringify({ chunk, done: false })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              await new Promise((resolve) => setTimeout(resolve, 50))
            }

            // Send final response
            const finalData = JSON.stringify({
              response: staticResponse,
              modelName: "static",
              modelType: "static",
              enabled: false,
              timing: {
                timeToFirstToken: 0,
                totalTime: Date.now() - Date.now(),
              },
              tokens: { input: 0, output: 0, total: 0 },
              done: true,
            })
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }

      // No static response available
      return new Response(
        JSON.stringify({
          error: "AI config is disabled and no static response available",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!aiConfig.model) {
      return new Response(
        JSON.stringify({ error: "AI model configuration is undefined" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!aiConfig.messages || aiConfig.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI config messages are undefined or empty" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // At this point, we know aiConfig.messages and aiConfig.model exist
    const messages = aiConfig.messages
    const model = aiConfig.model

    const tracker = aiConfig.createTracker()
    const startTime = Date.now()

    try {
      // Set up streaming response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Map AI config messages to conversation format
            const systemMessages = messages
              .filter((m) => m.role === "system")
              .map((m) => {
                const content =
                  typeof m.content === "string"
                    ? m.content
                    : JSON.stringify(m.content)
                return { role: "system" as const, content }
              })

            const conversationMessages = messages
              .filter((m) => m.role !== "system")
              .map((m) => {
                const content =
                  typeof m.content === "string"
                    ? m.content
                    : JSON.stringify(m.content)
                return { role: m.role as "user" | "assistant", content }
              })

            // Add context messages for product details and cart details
            const contextMessages: Array<{ role: "system"; content: string }> =
              []

            // Always include product catalog information as a system message
            // The LLM needs access to product information in every request to answer questions
            if (formattedProducts && formattedProducts.length > 0) {
              contextMessages.push({
                role: "system",
                content: `Store Product Catalog:\n${JSON.stringify(formattedProducts, null, 2)}\n\nYou have access to the complete product catalog above. Use this information to help customers find products, answer questions about availability, pricing, and product details. Always reference specific products by their exact name, ID, price, and details from the catalog. When customers ask about products, search the catalog and provide accurate information.`,
              })
            }

            // Add cart information as a system message if user has items in cart
            if (
              formattedCartDetails &&
              formattedCartDetails.items &&
              formattedCartDetails.items.length > 0
            ) {
              contextMessages.push({
                role: "system",
                content: `User's Shopping Cart:\n${JSON.stringify(formattedCartDetails, null, 2)}\n\nThe user currently has items in their cart. You can reference these items when helping them, suggest related products, or answer questions about their current cart.`,
              })
            }

            // Format chat history properly - ensure valid roles and content
            const historyMessages = Array.isArray(chatHistory)
              ? (chatHistory as ChatMessage[])
                  .filter((msg) => msg && msg.role && msg.content) // Filter out invalid messages
                  .map((msg) => ({
                    role:
                      msg.role === "user" || msg.role === "assistant"
                        ? (msg.role as "user" | "assistant")
                        : ("user" as const), // Default to user if invalid role
                    content: String(msg.content || ""),
                  }))
              : []

            // Add current user input as a user message
            const currentUserMessage = {
              role: "user" as const,
              content: userInput,
            }

            // Combine all messages in proper order:
            // 1. System messages from AI config
            // 2. Context messages (product catalog on first message, cart if applicable)
            // 3. Conversation messages from AI config (if any)
            // 4. Chat history (previous conversation)
            // 5. Current user input
            const allMessages = [
              ...systemMessages,
              ...contextMessages,
              ...conversationMessages,
              ...historyMessages,
              currentUserMessage,
            ]

            // Get model configuration
            let modelId = model.name
            const modelParams = model.parameters || {}
            const temperature = (modelParams.temperature as number) ?? 0.7
            const maxTokens = (modelParams.maxTokens as number) ?? 1000

            // Check if this is a Bedrock model
            const isBedrock = isBedrockModel(modelId)

            // Add 'us.' prefix for Bedrock cross-region inference if not present
            if (isBedrock && !modelId.startsWith("us.")) {
              modelId = "us." + modelId
            }

            // Check if this is a newer OpenAI model that requires max_completion_tokens
            // Models like o1, o3, gpt-5 require max_completion_tokens instead of max_tokens
            const requiresMaxCompletionTokens =
              modelId.includes("o1") ||
              modelId.includes("o3") ||
              modelId.includes("gpt-5") ||
              modelId.startsWith("o1-") ||
              modelId.startsWith("o3-") ||
              modelId.startsWith("gpt-5")

            let fullResponse = ""
            let timeToFirstToken = 0
            let firstTokenReceived = false
            let totalInputTokens = 0
            let totalOutputTokens = 0
            let totalTokens = 0

            if (isBedrock) {
              // Use AWS Bedrock streaming API with ConverseStreamCommand
              // Extract system messages for Bedrock's system parameter
              const bedrockSystemMessages = extractSystemMessages(allMessages)

              // Map non-system messages to Bedrock format
              const bedrockMessages = mapToBedrockMessages(allMessages)

              const streamCommand = new ConverseStreamCommand({
                modelId: modelId,
                ...(bedrockSystemMessages.length > 0
                  ? { system: bedrockSystemMessages }
                  : {}),
                messages: bedrockMessages,
                inferenceConfig: {
                  temperature: temperature,
                  maxTokens: maxTokens,
                },
              })

              const streamResponse = await bedrockClient.send(streamCommand)

              // Process the Bedrock stream
              for await (const chunk of streamResponse.stream ?? []) {
                if (chunk.contentBlockDelta?.delta?.text) {
                  // If this is the first token/chunk
                  if (!firstTokenReceived) {
                    timeToFirstToken = Date.now() - startTime
                    tracker?.trackTimeToFirstToken(timeToFirstToken)
                    firstTokenReceived = true
                  }

                  const textChunk = chunk.contentBlockDelta.delta.text
                  fullResponse += textChunk

                  // Stream each chunk to the client using SSE format
                  const chunkData = JSON.stringify({
                    chunk: textChunk,
                    done: false,
                  })
                  controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`))
                }

                // Capture token usage from metadata
                if (chunk.metadata?.usage) {
                  const usage = chunk.metadata.usage
                  totalInputTokens = usage.inputTokens ?? totalInputTokens
                  totalOutputTokens = usage.outputTokens ?? totalOutputTokens
                  totalTokens = usage.totalTokens ?? totalTokens
                }
              }
            } else {
              // Use OpenAI or other compatible API
              const openaiApiKey = process.env.OPENAI_API_KEY
              if (!openaiApiKey) {
                throw new Error("OPENAI_API_KEY is not set")
              }

              // Build request body with appropriate token parameter (non-streaming for newer models)
              const requestBody: Record<string, unknown> = {
                model: modelId,
                messages: allMessages.map((m) => ({
                  role: m.role === "system" ? "system" : m.role,
                  content: m.content,
                })),
              }

              // Use max_completion_tokens for newer models (o1, o3, gpt-5), max_tokens for others
              // Note: o1, o3, and gpt-5 models don't support temperature parameter
              if (requiresMaxCompletionTokens) {
                requestBody.max_completion_tokens = maxTokens
                // o1, o3, and gpt-5 models don't support temperature - omit it
              } else {
                requestBody.temperature = temperature
                requestBody.max_tokens = maxTokens
              }

              const response = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${openaiApiKey}`,
                  },
                  body: JSON.stringify(requestBody),
                }
              )

              if (!response.ok) {
                const errorText = await response.text()
                throw new Error(
                  `OpenAI API error: ${response.statusText} - ${errorText}`
                )
              }

              // Parse complete JSON response (non-streaming)
              const responseData = await response.json()

              // Extract response content
              fullResponse = responseData.choices?.[0]?.message?.content || ""

              // If content is empty, check for reasoning or other content
              if (!fullResponse && responseData.choices?.[0]?.message) {
                const message = responseData.choices[0].message
                if (message.reasoning) {
                  fullResponse = message.reasoning
                } else if (
                  message.annotations &&
                  message.annotations.length > 0
                ) {
                  fullResponse = message.annotations[0].content || ""
                } else {
                  fullResponse =
                    "I apologize, but I'm having trouble generating a response at the moment. Please try again."
                }
              }

              // Track time to first token (same as total time for non-streaming)
              timeToFirstToken = Date.now() - startTime
              tracker?.trackTimeToFirstToken(timeToFirstToken)
              firstTokenReceived = true

              // Extract token usage from response
              if (responseData.usage) {
                totalInputTokens = responseData.usage.prompt_tokens ?? 0
                totalOutputTokens = responseData.usage.completion_tokens ?? 0
                totalTokens = responseData.usage.total_tokens ?? 0
              }

              // Send complete response as a single chunk (simulate streaming for client)
              const chunkData = JSON.stringify({
                chunk: fullResponse,
                done: false,
              })
              controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`))
            }

            // If tokens weren't captured from stream, estimate them
            if (totalTokens === 0 && fullResponse.length > 0) {
              // Rough estimation: ~4 characters per token for English text
              // This is a fallback - actual usage is preferred
              const estimatedOutputTokens = Math.ceil(fullResponse.length / 4)
              const estimatedInputTokens = Math.ceil(
                allMessages.reduce(
                  (sum, msg) =>
                    sum +
                    (typeof msg.content === "string" ? msg.content.length : 0),
                  0
                ) / 4
              )
              totalInputTokens = estimatedInputTokens
              totalOutputTokens = estimatedOutputTokens
              totalTokens = estimatedInputTokens + estimatedOutputTokens
            }

            // Track token usage
            const tokens: LDTokenUsage = {
              input: totalInputTokens,
              output: totalOutputTokens,
              total: totalTokens,
            }
            tracker?.trackTokens?.(tokens)

            // Calculate total generation time
            const totalTime = Date.now() - startTime
            tracker?.trackDuration?.(totalTime)

            // Try to extract product information from the response
            // Look for product names and sizes in the response
            let productData:
              | {
                  productId?: string
                  productName?: string
                  selectedSize?: string
                }
              | undefined

            // Check if response mentions a product and indicates it's ready to add
            const readyKeywords = [
              "ready",
              "add to cart",
              "selected",
              "here is",
              "here's",
              "would you like to add",
              "i've selected",
              "i have selected",
            ]
            const isReady = readyKeywords.some((keyword) =>
              fullResponse.toLowerCase().includes(keyword)
            )

            if (isReady) {
              // Try to find product by name in response
              for (const product of formattedProducts) {
                const productNameLower = product.name.toLowerCase()
                const responseLower = fullResponse.toLowerCase()

                if (
                  responseLower.includes(productNameLower) ||
                  responseLower.includes(productNameLower.replace(/\s+/g, " "))
                ) {
                  productData = {
                    productId: product.id,
                    productName: product.name,
                  }

                  // Try to extract size from response
                  const sizeMatch = fullResponse.match(
                    /\b(size|Size|SIZE)\s*:?\s*([SMXL]+|Small|Medium|Large|Extra\s*Large)\b/i
                  )
                  if (sizeMatch && product.sizes) {
                    const sizeValue = sizeMatch[2].toUpperCase()
                    // Find matching size in product sizes
                    const matchedSize = product.sizes.find((s: string) => {
                      const sUpper = s.toUpperCase()
                      if (
                        sizeValue.includes("S") &&
                        !sizeValue.includes("M") &&
                        sUpper.includes("S") &&
                        !sUpper.includes("M")
                      )
                        return true
                      if (
                        sizeValue.includes("M") &&
                        !sizeValue.includes("L") &&
                        sUpper.includes("M") &&
                        !sUpper.includes("L")
                      )
                        return true
                      if (
                        sizeValue.includes("L") &&
                        !sizeValue.includes("X") &&
                        sUpper.includes("L") &&
                        !sUpper.includes("X")
                      )
                        return true
                      if (sizeValue.includes("XL") && sUpper.includes("XL"))
                        return true
                      return sUpper === sizeValue
                    })
                    if (matchedSize) {
                      productData.selectedSize = matchedSize
                    }
                  }
                  break
                }
              }
            }

            // Send final response with metadata
            const finalData = JSON.stringify({
              response: fullResponse,
              modelName: model.name,
              modelType: isBedrock ? "bedrock" : "openai",
              enabled: aiConfig.enabled,
              timing: {
                timeToFirstToken: timeToFirstToken || totalTime,
                totalTime,
              },
              tokens,
              productData,
              done: true,
            })

            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            controller.close()

            // Track success
            tracker?.trackSuccess()
          } catch (error) {
            const errorObj =
              error instanceof Error ? error : new Error(String(error))

            logger.error("Error in chat streaming", errorObj, {
              endpoint: "/api/chat",
              component: "chat-streaming",
              aiConfigKey,
            })

            // Record error to LaunchDarkly observability
            await recordErrorToLD(errorObj, "Error in chat streaming", {
              component: "ChatStreaming",
              endpoint: "/api/chat",
              aiConfigKey,
            })

            tracker?.trackError()

            const errorMessage =
              error instanceof Error ? error.message : "Internal Server Error"
            const errorData = JSON.stringify({
              error: errorMessage,
              done: true,
            })

            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error))

      logger.error("Error in chat API", errorObj, {
        endpoint: "/api/chat",
        component: "chat-api",
        aiConfigKey,
      })

      // Record error to LaunchDarkly observability
      await recordErrorToLD(errorObj, "Error in chat API", {
        component: "ChatAPI",
        endpoint: "/api/chat",
        aiConfigKey,
      })
      const errorMessage =
        error instanceof Error ? error.message : "Internal Server Error"
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))

    logger.error("Error in chat API (outer catch)", errorObj, {
      endpoint: "/api/chat",
      component: "chat-api-outer",
    })

    // Record error to LaunchDarkly observability
    await recordErrorToLD(errorObj, "Error in chat API (outer catch)", {
      component: "ChatAPIOuter",
      endpoint: "/api/chat",
    })
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
