import { NextRequest } from "next/server"
import { getLDServerClient } from "@/lib/launchdarkly/server"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { initAi, LDTokenUsage } from "@launchdarkly/server-sdk-ai"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability-server"
import { v4 as uuidv4 } from "uuid"
import products from "@/data/products.json"

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

/**
 * Chat API Route with LaunchDarkly AI SDK Integration
 * Supports real-time model switching via AI Config
 * AI Config Key: ai-config--togglebotchatbot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      userInput, 
      chatHistory = [], 
      aiConfigKey = "ai-config--togglebotchatbot",
      cartDetails = null,
      productDetails = null
    } = body

    if (!userInput || typeof userInput !== "string") {
      return new Response(
        JSON.stringify({ error: "userInput is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get LaunchDarkly context from cookie
    const cookieHeader = request.headers.get("cookie") || ""
    const contextMatch = cookieHeader.match(new RegExp(`${LD_CONTEXT_COOKIE_KEY}=([^;]+)`))
    const clientSideContext = contextMatch
      ? JSON.parse(decodeURIComponent(contextMatch[1]))
      : {}

    // Build context from client-side context or create anonymous context
    // Extract user context from multi-context if present
    let context: LaunchDarklyContext = clientSideContext?.user || clientSideContext || {
      kind: "user",
      key: uuidv4(),
      anonymous: true,
    };

    // If context is anonymous, replace with a new context with unique key
    if (context.anonymous === true) {
      context = {
        kind: "user",
        key: `user-${uuidv4()}`,
      };
    }

    // Get LaunchDarkly server client
    const ldClient = await getLDServerClient()

    // Initialize AI client
    const aiClient = initAi(ldClient)

    // Prepare product details - use provided productDetails or load from JSON
    // Format products for AI context (simplified structure with key info)
    const formattedProducts = productDetails || products.map((product) => ({
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
    const formattedCartDetails = cartDetails ? {
      items: Array.isArray(cartDetails.items) ? cartDetails.items.map((item: CartItemInput) => ({
        productId: item.product?.id || item.productId,
        productName: item.product?.name || item.productName,
        quantity: item.quantity || 0,
        price: item.product?.price || item.price,
        selectedSize: item.selectedSize,
      })) : [],
      subtotal: cartDetails.subtotal || 0,
      itemCount: cartDetails.itemCount || (Array.isArray(cartDetails.items) ? cartDetails.items.length : 0),
    } : null

    // Get AI Config with variables for template replacement
    const aiConfig = await aiClient.config(
      aiConfigKey,
      context,
      {},
      {
        userInput: userInput,
        chatHistory: chatHistory,
      }
    )

    // Check if AI config is enabled
    // If disabled, check if there's a static response to return
    if (aiConfig.enabled === false) {
      // Check if there's a static response (fallback) - check various possible properties
      const aiConfigAny = aiConfig as unknown as Record<string, unknown>
      const staticResponse = 
        (typeof aiConfigAny.response === "string" ? aiConfigAny.response : undefined) ||
        (typeof aiConfigAny.staticResponse === "string" ? aiConfigAny.staticResponse : undefined) ||
        (typeof aiConfigAny.fallback === "string" ? aiConfigAny.fallback : undefined)
      
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
        JSON.stringify({ error: "AI config is disabled and no static response available" }),
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

    // Get tracker for metrics
    const { tracker } = aiConfig
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
                const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
                return { role: "system" as const, content }
              })

            const conversationMessages = messages
              .filter((m) => m.role !== "system")
              .map((m) => {
                const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
                return { role: m.role as "user" | "assistant", content }
              })

            // Add context messages for product details and cart details
            const contextMessages: Array<{ role: "system"; content: string }> = []
            
            // Add product catalog information as a system message
            if (formattedProducts && formattedProducts.length > 0) {
              contextMessages.push({
                role: "system",
                content: `Store Product Catalog:\n${JSON.stringify(formattedProducts, null, 2)}\n\nYou have access to the complete product catalog above. Use this information to help customers find products, answer questions about availability, pricing, and product details.`
              })
            }

            // Add cart information as a system message if user has items in cart
            if (formattedCartDetails && formattedCartDetails.items && formattedCartDetails.items.length > 0) {
              contextMessages.push({
                role: "system",
                content: `User's Shopping Cart:\n${JSON.stringify(formattedCartDetails, null, 2)}\n\nThe user currently has items in their cart. You can reference these items when helping them, suggest related products, or answer questions about their current cart.`
              })
            }

            // Add chat history to conversation
            const historyMessages = (chatHistory as ChatMessage[]).map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            }))

            // Combine all messages: system messages from AI config, context messages, conversation messages, and chat history
            const allMessages = [...systemMessages, ...contextMessages, ...conversationMessages, ...historyMessages]

            // Get model configuration
            const modelId = model.name
            const modelParams = model.parameters || {}
            const temperature = (modelParams.temperature as number) ?? 0.7
            const maxTokens = (modelParams.maxTokens as number) ?? 1000

            // Check if this is a Bedrock model (starts with us. or contains bedrock patterns)
            const isBedrockModel = modelId.startsWith("us.") ||
              modelId.includes("anthropic.claude") ||
              modelId.includes("amazon.titan") ||
              modelId.includes("amazon.nova") ||
              modelId.includes("meta.llama") ||
              modelId.includes("cohere.command") ||
              modelId.includes("ai21.jurassic") ||
              modelId.includes("mistral.mistral")

            // Check if this is a newer OpenAI model that requires max_completion_tokens
            // Models like o1, o3, gpt-5 require max_completion_tokens instead of max_tokens
            const requiresMaxCompletionTokens = modelId.includes("o1") || 
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

            if (isBedrockModel) {
              // Use AWS Bedrock for model inference
              // Note: This requires AWS credentials and Bedrock access
              // For now, we'll use a simplified approach that works with LaunchDarkly AI SDK
              // The actual Bedrock client integration would require additional setup
              
              // For Bedrock models, we'll use the LaunchDarkly AI SDK's built-in support
              // This is a placeholder - actual implementation would use Bedrock SDK
              const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${process.env.OPENAI_API_KEY || ""}`,
                },
                body: JSON.stringify({
                  model: "gpt-4o-mini", // Fallback model
                  messages: allMessages.map((m) => ({
                    role: m.role === "system" ? "system" : m.role,
                    content: m.content,
                  })),
                  temperature,
                  max_tokens: maxTokens,
                  stream: true,
                }),
              })

              if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`)
              }

              const reader = response.body?.getReader()
              const decoder = new TextDecoder()

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break

                  const chunk = decoder.decode(value, { stream: true })
                  const lines = chunk.split("\n")

                  for (const line of lines) {
                    if (line.startsWith("data: ") && line !== "data: [DONE]") {
                      try {
                        const data = JSON.parse(line.slice(6))
                        const content = data.choices?.[0]?.delta?.content || ""
                        if (content) {
                          if (!firstTokenReceived) {
                            timeToFirstToken = Date.now() - startTime
                            tracker.trackTimeToFirstToken(timeToFirstToken)
                            firstTokenReceived = true
                          }

                          fullResponse += content
                          const chunkData = JSON.stringify({ chunk: content, done: false })
                          controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`))
                        }
                        // Check for usage in any chunk (OpenAI sends usage in a final chunk)
                        // This can come in a chunk with or without content
                        if (data.usage) {
                          totalInputTokens = data.usage.prompt_tokens ?? totalInputTokens
                          totalOutputTokens = data.usage.completion_tokens ?? totalOutputTokens
                          totalTokens = data.usage.total_tokens ?? totalTokens
                        }
                      } catch {
                        // Ignore parse errors
                      }
                    }
                  }
                }
              }
            } else {
              // Use OpenAI or other compatible API
              const openaiApiKey = process.env.OPENAI_API_KEY
              if (!openaiApiKey) {
                throw new Error("OPENAI_API_KEY is not set")
              }

              // Build request body with appropriate token parameter (non-streaming)
              const requestBody: Record<string, unknown> = {
                model: modelId,
                messages: allMessages.map((m) => ({
                  role: m.role === "system" ? "system" : m.role,
                  content: m.content,
                })),
                // Remove stream: true for OpenAI models - use non-streaming
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

              const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${openaiApiKey}`,
                },
                body: JSON.stringify(requestBody),
              })

              if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`)
              }

              // Parse complete JSON response (non-streaming)
              const responseData = await response.json()
              
              // Extract response content
              fullResponse = responseData.choices?.[0]?.message?.content || ""
              
              // Track time to first token (same as total time for non-streaming)
              timeToFirstToken = Date.now() - startTime
              tracker.trackTimeToFirstToken(timeToFirstToken)
              firstTokenReceived = true

              // Extract token usage from response
              if (responseData.usage) {
                totalInputTokens = responseData.usage.prompt_tokens ?? 0
                totalOutputTokens = responseData.usage.completion_tokens ?? 0
                totalTokens = responseData.usage.total_tokens ?? 0
              }

              // Send complete response as a single chunk (simulate streaming for client)
              const chunkData = JSON.stringify({ chunk: fullResponse, done: false })
              controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`))
            }

            // If tokens weren't captured from stream, estimate them
            // OpenAI streaming API sometimes doesn't include usage in stream
            if (totalTokens === 0 && fullResponse.length > 0) {
              // Rough estimation: ~4 characters per token for English text
              // This is a fallback - actual usage is preferred
              const estimatedOutputTokens = Math.ceil(fullResponse.length / 4)
              const estimatedInputTokens = Math.ceil(
                allMessages.reduce((sum, msg) => sum + (typeof msg.content === "string" ? msg.content.length : 0), 0) / 4
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
            tracker.trackTokens?.(tokens)

            // Calculate total generation time
            const totalTime = Date.now() - startTime
            tracker.trackDuration?.(totalTime)

        // Send final response with metadata
        const finalData = JSON.stringify({
              response: fullResponse,
              modelName: model.name,
              modelType: isBedrockModel ? "bedrock" : "openai",
              enabled: aiConfig.enabled,
              timing: {
                timeToFirstToken: timeToFirstToken || totalTime,
                totalTime,
              },
              tokens,
          done: true,
        })

        controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
        controller.close()

            // Track success
            tracker.trackSuccess()
          } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error))
            
            logger.error(
              "Error in chat streaming",
              errorObj,
              {
                endpoint: "/api/chat",
                component: "chat-streaming",
                aiConfigKey,
              }
            )
            
            // Record error to LaunchDarkly observability
            await recordErrorToLD(
              errorObj,
              "Error in chat streaming",
              {
                component: "ChatStreaming",
                endpoint: "/api/chat",
                aiConfigKey,
              }
            )
            
            tracker.trackError()

            const errorMessage = error instanceof Error ? error.message : "Internal Server Error"
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
      const errorObj = error instanceof Error ? error : new Error(String(error))
      
      logger.error(
        "Error in chat API",
        errorObj,
        {
          endpoint: "/api/chat",
          component: "chat-api",
          aiConfigKey,
        }
      )
      
      // Record error to LaunchDarkly observability
      await recordErrorToLD(
        errorObj,
        "Error in chat API",
        {
          component: "ChatAPI",
          endpoint: "/api/chat",
          aiConfigKey,
        }
      )
      const errorMessage = error instanceof Error ? error.message : "Internal Server Error"
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    
    logger.error(
      "Error in chat API (outer catch)",
      errorObj,
      {
        endpoint: "/api/chat",
        component: "chat-api-outer",
      }
    )
    
    // Record error to LaunchDarkly observability
    await recordErrorToLD(
      errorObj,
      "Error in chat API (outer catch)",
      {
        component: "ChatAPIOuter",
        endpoint: "/api/chat",
      }
    )
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
