import { initAi, LDTokenUsage } from "@launchdarkly/server-sdk-ai"
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime"
import { getLDServerClient } from "@/lib/launchdarkly/server"
import { logger } from "@/lib/logger"
import products from "@/data/products.json"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentContext {
  userInput: string
  customerContext: Record<string, unknown>
  chatHistory: Array<{ role: string; content: string }>
  cartDetails?: Record<string, unknown> | null
  ldContext: Record<string, unknown>
}

export interface AgentResult {
  content: string
  agentKey: string
  modelName: string
  tokens: LDTokenUsage
  durationMs: number
}

export interface PipelineResult {
  finalResponse: string
  triageResult: AgentResult
  specialistResult: AgentResult
  brandVoiceResult: AgentResult
  triageCategory: string
  totalDurationMs: number
}

type StatusCallback = (status: string) => void

// ---------------------------------------------------------------------------
// Config keys
// ---------------------------------------------------------------------------

const AGENT_KEYS = {
  triage: "ai-config--togglestore-triage",
  product: "ai-config--togglestore-product-specialist",
  order: "ai-config--togglestore-order-specialist",
  style: "ai-config--togglestore-style-advisor",
  brandVoice: "ai-config--togglestore-brand-voice",
} as const

const CATEGORY_TO_AGENT: Record<string, keyof typeof AGENT_KEYS> = {
  products: "product",
  orders: "order",
  style: "style",
  general: "product", // fallback general queries to product specialist
}

// ---------------------------------------------------------------------------
// Tool handlers (stubs that return contextual data)
// ---------------------------------------------------------------------------

function handleGetCustomerContext(
  ldContext: Record<string, unknown>
): Record<string, unknown> {
  const user =
    ldContext.kind === "multi"
      ? (ldContext.user as Record<string, unknown>) || {}
      : ldContext
  return {
    name: user.name || "Guest",
    tier: user.tier || "Standard",
    preferences: user.role || "General",
    location: user.location || "Unknown",
  }
}

function handleSearchProductCatalog(query: string): string {
  const q = query.toLowerCase()
  const matches = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(q)))
    )
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      sizes: p.sizes || [],
    }))
  return JSON.stringify(matches)
}

function handleCheckOrderStatus(orderId: string): string {
  return JSON.stringify({
    orderId,
    status: "shipped",
    trackingNumber: `TGL-${orderId.toUpperCase()}-${Date.now().toString(36)}`,
    estimatedDelivery: new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .split("T")[0],
    returnEligible: true,
  })
}

function handleGetSizeRecommendation(productId: string): string {
  const product = products.find((p) => p.id === productId)
  return JSON.stringify({
    productId,
    productName: product?.name || "Unknown",
    recommendation: "Based on typical fit, we recommend size M/L for most customers.",
    availableSizes: product?.sizes || [],
    fitNotes: "This item runs true to size.",
  })
}

// ---------------------------------------------------------------------------
// LLM invocation (supports Bedrock + OpenAI)
// ---------------------------------------------------------------------------

function isBedrockModel(modelName: string): boolean {
  const patterns = [
    "anthropic.claude",
    "amazon.titan",
    "amazon.nova",
    "meta.llama",
    "cohere.command",
    "mistral.mistral",
    "deepseek.deepseek",
  ]
  return (
    modelName.startsWith("us.") ||
    patterns.some((p) => modelName.includes(p))
  )
}

async function invokeLLM(
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  bedrockClient: BedrockRuntimeClient
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  let modelId = modelName
  const isBedrock = isBedrockModel(modelId)

  if (isBedrock) {
    if (!modelId.startsWith("us.")) modelId = "us." + modelId

    const command = new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig: { temperature: 0.5, maxTokens: 1000 },
    })

    const response = await bedrockClient.send(command)
    const content =
      response.output?.message?.content?.[0]?.text || ""
    return {
      content,
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
    }
  }

  // OpenAI path
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not set")

  const isNewModel =
    modelId.includes("o1") ||
    modelId.includes("o3") ||
    modelId.includes("gpt-5")

  const body: Record<string, unknown> = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  }

  if (isNewModel) {
    body.max_completion_tokens = 1000
  } else {
    body.temperature = 0.5
    body.max_tokens = 1000
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`OpenAI API error: ${resp.statusText} - ${errText}`)
  }

  const data = await resp.json()
  return {
    content: data.choices?.[0]?.message?.content || "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Individual agent runner
// ---------------------------------------------------------------------------

async function runAgent(
  aiConfigKey: string,
  ldContext: Record<string, unknown>,
  templateVars: Record<string, unknown>,
  bedrockClient: BedrockRuntimeClient
): Promise<AgentResult> {
  const ldClient = await getLDServerClient()
  const aiClient = initAi(ldClient)

  const aiConfig = await aiClient.config(
    aiConfigKey,
    ldContext as Parameters<typeof aiClient.config>[1],
    {},
    templateVars
  )

  if (!aiConfig.model) {
    throw new Error(`AI config ${aiConfigKey} has no model configured`)
  }

  const tracker = aiConfig.createTracker()
  const startTime = Date.now()

  const systemPrompt =
    aiConfig.messages
      ?.filter((m) => m.role === "system")
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .join("\n") || ""

  const instructions = (aiConfig as unknown as Record<string, unknown>)
    .instructions as string | undefined

  const effectiveSystem = instructions || systemPrompt || ""

  const userPrompt =
    aiConfig.messages
      ?.filter((m) => m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .join("\n") ||
    (templateVars.userInput as string) ||
    ""

  const llmResult = await invokeLLM(
    aiConfig.model.name,
    effectiveSystem,
    userPrompt,
    bedrockClient
  )

  const durationMs = Date.now() - startTime

  const tokens: LDTokenUsage = {
    input: llmResult.inputTokens,
    output: llmResult.outputTokens,
    total: llmResult.inputTokens + llmResult.outputTokens,
  }

  tracker.trackTokens(tokens)
  tracker.trackDuration(durationMs)
  tracker.trackTimeToFirstToken(durationMs)
  tracker.trackSuccess()

  return {
    content: llmResult.content,
    agentKey: aiConfigKey,
    modelName: aiConfig.model.name,
    tokens,
    durationMs,
  }
}

// ---------------------------------------------------------------------------
// Main pipeline: Triage → Specialist → Brand Voice
// ---------------------------------------------------------------------------

export async function runMultiAgentPipeline(
  ctx: AgentContext,
  onStatus?: StatusCallback
): Promise<PipelineResult> {
  const pipelineStart = Date.now()

  const region =
    process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-west-2"
  const bedrockClient = new BedrockRuntimeClient({ region })

  const customerContext = handleGetCustomerContext(ctx.ldContext)

  // ── Step 1: Triage ──
  onStatus?.("Analyzing your query...")

  const triageResult = await runAgent(
    AGENT_KEYS.triage,
    ctx.ldContext,
    {
      userInput: ctx.userInput,
      customer_context: JSON.stringify(customerContext),
      chatHistory: ctx.chatHistory,
    },
    bedrockClient
  )

  let category = "general"
  try {
    const parsed = JSON.parse(triageResult.content)
    category = parsed.category || "general"
  } catch {
    const lower = triageResult.content.toLowerCase()
    if (lower.includes("products")) category = "products"
    else if (lower.includes("orders")) category = "orders"
    else if (lower.includes("style")) category = "style"
  }

  const specialistKey =
    CATEGORY_TO_AGENT[category] || "product"

  // ── Step 2: Specialist ──
  const specialistLabels: Record<string, string> = {
    product: "Consulting Product Specialist...",
    order: "Consulting Order & Returns Specialist...",
    style: "Consulting Style & Sizing Advisor...",
  }
  onStatus?.(specialistLabels[specialistKey] || "Consulting specialist...")

  const toolResults: string[] = []

  if (specialistKey === "product") {
    toolResults.push(handleSearchProductCatalog(ctx.userInput))
  } else if (specialistKey === "order") {
    const orderMatch = ctx.userInput.match(/order[#\s-]*(\w+)/i)
    toolResults.push(handleCheckOrderStatus(orderMatch?.[1] || "unknown"))
  } else if (specialistKey === "style") {
    toolResults.push(handleSearchProductCatalog(ctx.userInput))
    const productMatch = products.find((p) =>
      ctx.userInput.toLowerCase().includes(p.name.toLowerCase())
    )
    if (productMatch) {
      toolResults.push(handleGetSizeRecommendation(productMatch.id))
    }
  }

  const specialistResult = await runAgent(
    AGENT_KEYS[specialistKey],
    ctx.ldContext,
    {
      userInput: ctx.userInput,
      customer_context: JSON.stringify(customerContext),
      chatHistory: ctx.chatHistory,
      toolResults: toolResults.join("\n\n"),
      products_list: products.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
        sizes: p.sizes || [],
      })),
    },
    bedrockClient
  )

  // ── Step 3: Brand Voice ──
  onStatus?.("Applying brand voice...")

  const brandVoiceResult = await runAgent(
    AGENT_KEYS.brandVoice,
    ctx.ldContext,
    {
      userInput: ctx.userInput,
      draftResponse: specialistResult.content,
      customer_context: JSON.stringify(customerContext),
    },
    bedrockClient
  )

  const totalDurationMs = Date.now() - pipelineStart

  logger.info("Multi-agent pipeline completed", {
    category,
    specialist: specialistKey,
    triageModel: triageResult.modelName,
    specialistModel: specialistResult.modelName,
    brandVoiceModel: brandVoiceResult.modelName,
    totalDurationMs,
  })

  return {
    finalResponse: brandVoiceResult.content,
    triageResult,
    specialistResult,
    brandVoiceResult,
    triageCategory: category,
    totalDurationMs,
  }
}
