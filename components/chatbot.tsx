"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useFlags } from "launchdarkly-react-client-sdk"
import { useLoginContext } from "@/lib/login-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability"
import { useTrackMetric } from "@/lib/launchdarkly/metrics"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import { Product } from "@/types/product"
import productsData from "@/data/products.json"
import { MiniProductCard } from "@/components/mini-product-card"

interface Message {
  id: string
  role: "user" | "assistant" | "judge"
  content: string
  productData?: {
    productId?: string
    productName?: string
    selectedSize?: string
  }
  judgeScores?: {
    before?: {
      accuracy?: number
      relevance?: number
    }
    after?: {
      accuracy?: number
      relevance?: number
    }
  }
}

interface ChatBotProps {
  aiConfigKey?: string
  selfHealingAiConfigKey?: string
  onAddToCart?: (product: Product, quantity?: number, selectedSize?: string) => void
}

const products = productsData as Product[]

interface FlagWithMeta {
  _ldMeta?: {
    enabled?: boolean
  }
  model?: {
    name?: string
  }
  [key: string]: unknown
}

// Tab types for the chatbot
type ChatTab = "experiment" | "self-healing"

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm your ToggleStore assistant. How can I help you today?",
}

const SELF_HEALING_INITIAL_MESSAGE: Message = {
  id: "welcome-self-heal",
  role: "assistant",
  content: "Hi! I'm ToggleBot. How can I help you today?",
}

export function ChatBot({ 
  aiConfigKey = "ai-config--togglebotchatbot", 
  selfHealingAiConfigKey = "ai-config--togglebot-self-heal-chatbot",
  onAddToCart 
}: ChatBotProps) {
  const flags = useFlags()
  const flag = flags[aiConfigKey] as FlagWithMeta | undefined
  const selfHealingFlag = flags[selfHealingAiConfigKey] as FlagWithMeta | undefined
  const { appMultiContext } = useLoginContext()
  const trackMetric = useTrackMetric()
  
  // Check if chatbot is enabled: flag?._ldMeta?.enabled !== false
  const isEnabled = flag?._ldMeta?.enabled !== false
  const isSelfHealingEnabled = selfHealingFlag?._ldMeta?.enabled !== false

  // Tab state
  const [activeTab, setActiveTab] = useState<ChatTab>("experiment")
  
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  
  // Separate message states for each tab
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [selfHealingMessages, setSelfHealingMessages] = useState<Message[]>([SELF_HEALING_INITIAL_MESSAGE])
  
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selfHealingMessagesEndRef = useRef<HTMLDivElement>(null)
  const contextKeyRef = useRef<string | null>(null)
  const hasSentInitialMessage = useRef(false)
  
  // Separate metrics for each tab
  const [metrics, setMetrics] = useState<{
    modelName?: string
    modelType?: string
    timing?: {
      timeToFirstToken?: number
      totalTime?: number
    }
    tokens?: {
      input?: number
      output?: number
      total?: number
    }
  } | null>(null)
  
  const [selfHealingMetrics, setSelfHealingMetrics] = useState<{
    modelName?: string
    modelType?: string
    timing?: {
      timeToFirstToken?: number
      totalTime?: number
    }
    tokens?: {
      input?: number
      output?: number
      total?: number
    }
    judgeScores?: {
      before?: {
      accuracy?: number
      relevance?: number
    }
    after?: {
      accuracy?: number
      relevance?: number
    }
  }
  didFallback?: boolean
} | null>(null)
  
  const [suggestedProducts, setSuggestedProducts] = useState<Array<{
    product: Product
    selectedSize?: string
  }>>([])
  
  const [selfHealingSuggestedProducts, setSelfHealingSuggestedProducts] = useState<Array<{
    product: Product
    selectedSize?: string
  }>>([])
  
  // Toggle for enabling/disabling fallback in self-healing mode
  // When false, shows only the bad response without self-healing
  const [enableFallback, setEnableFallback] = useState(true)
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)

  const scrollToBottom = useCallback(() => {
    if (activeTab === "experiment") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    } else {
      selfHealingMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [activeTab])

  useEffect(() => {
    scrollToBottom()
  }, [messages, selfHealingMessages, activeTab, scrollToBottom])

  // Clear chat history when LaunchDarkly context changes
  useEffect(() => {
    if (!appMultiContext) return

    // Generate a unique key for the current context to detect changes
    const contextUser = appMultiContext?.user as { key?: string; email?: string } | undefined
    const currentContextKey = contextUser?.key || 
                              contextUser?.email || 
                              JSON.stringify(appMultiContext)

    // If context has changed (and it's not the initial load), clear chat history for both tabs
    if (contextKeyRef.current !== null && contextKeyRef.current !== currentContextKey) {
      setMessages([INITIAL_MESSAGE])
      setSelfHealingMessages([SELF_HEALING_INITIAL_MESSAGE])
      setMetrics(null)
      setSelfHealingMetrics(null)
      setMessage("")
      setSuggestedProducts([])
      setSelfHealingSuggestedProducts([])
    }

    // Update the ref with the current context key
    contextKeyRef.current = currentContextKey
  }, [appMultiContext])

  // Auto-send sample conversation when chatbot opens (only for experiment tab)
  useEffect(() => {
    if (open && isEnabled && activeTab === "experiment" && !hasSentInitialMessage.current && messages.length === 1) {
      hasSentInitialMessage.current = true
      
      // Pre-generated conversation flow - show instantly
      const conversationFlow = () => {
        // All messages at once - pre-generated, no loading states
        const userMessage1: Message = {
          id: Date.now().toString(),
          role: "user",
          content: "I'm looking for some socks",
        }
        
        const botMessage1: Message = {
          id: Date.now().toString() + "-1",
          role: "assistant",
          content: "Great! I can help you find socks. We have **Feature Flag Socks** available in our store. What size are you looking for?",
        }
        
        const userMessage2: Message = {
          id: Date.now().toString() + "-2",
          role: "user",
          content: "XL please",
        }
        
        const botMessage2: Message = {
          id: Date.now().toString() + "-3",
          role: "assistant",
          content: "Perfect! I found our **Feature Flag Socks** in size XL. They're comfortable crew socks with fun feature flag designs.",
        }
        
        // Add all messages at once
        setMessages((prev) => [
          ...prev,
          userMessage1,
          botMessage1,
          userMessage2,
          botMessage2,
        ])
        
        // Show socks product card in sample conversation
        const socksProduct = products.find(p => p.id === "prod-socks")
        if (socksProduct) {
          setSuggestedProducts([{
            product: socksProduct,
            selectedSize: socksProduct.sizes.find(s => s.includes("XL")) || socksProduct.sizes[0]
          }])
        }
      }

      // Small delay just for visual smoothness, then show everything
      setTimeout(() => {
        conversationFlow()
      }, 300)
    }
  }, [open, isEnabled, activeTab, messages.length, aiConfigKey])

  // Reset initial message flag when dialog closes
  useEffect(() => {
    if (!open) {
      hasSentInitialMessage.current = false
    }
  }, [open])

  // Check if user message is product-related
  const isProductQuery = (message: string): boolean => {
    const messageLower = message.toLowerCase()
    const productKeywords = [
      'product', 'item', 'buy', 'purchase', 'shop', 'shopping', 'cart', 'add to cart',
      'sock', 'socks', 'shirt', 'shirts', 'hat', 'hats', 'watch', 'watches',
      'mug', 'mugs', 'skateboard', 'skateboards', 'shoe', 'shoes', 'float', 'floats',
      'mask', 'masks', 'sticker', 'stickers', 'vr', 'rocket', 'rockets',
      'looking for', 'find', 'search', 'show me', 'i want', 'i need', 'get me',
      'price', 'cost', 'how much', 'available', 'in stock', 'size', 'sizes'
    ]
    
    // Check if message contains product keywords
    const hasProductKeyword = productKeywords.some(keyword => messageLower.includes(keyword))
    
    // Check if message mentions any product name
    const mentionsProduct = products.some(product => 
      messageLower.includes(product.name.toLowerCase()) ||
      product.name.toLowerCase().split(' ').some(word => 
        word.length > 3 && messageLower.includes(word)
      )
    )
    
    return hasProductKeyword || mentionsProduct
  }

  // Search products and return top matches
  const searchProducts = (query: string, limit: number = 3): Array<{ product: Product; selectedSize?: string; score: number }> => {
    if (!query.trim()) return []
    
    const queryLower = query.toLowerCase().trim()
    const results: Array<{ product: Product; selectedSize?: string; score: number }> = []
    
    // Extract size from query if present
    const sizeMatch = query.match(/\b(size|Size|SIZE|s|m|l|xl|xxl|small|medium|large|extra\s*large)\s*:?\s*([SMXL]+|Small|Medium|Large|Extra\s*Large|S|M|L|XL|XXL)\b/i)
    let extractedSize: string | undefined
    if (sizeMatch) {
      const sizeValue = sizeMatch[2] || sizeMatch[1]
      extractedSize = sizeValue.toUpperCase()
    }
    
    for (const product of products) {
      let score = 0
      const productNameLower = product.name.toLowerCase()
      const descriptionLower = product.description.toLowerCase()
      const categoryLower = product.category.toLowerCase()
      
      // Exact name match (highest score)
      if (productNameLower === queryLower) {
        score += 100
      }
      // Name contains query
      else if (productNameLower.includes(queryLower)) {
        score += 50
      }
      // Query contains product name
      else if (queryLower.includes(productNameLower)) {
        score += 40
      }
      // Word matches in name
      else {
        const queryWords = queryLower.split(/\s+/)
        const nameWords = productNameLower.split(/\s+/)
        const matchingWords = queryWords.filter(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw)))
        score += matchingWords.length * 10
      }
      
      // Description match
      if (descriptionLower.includes(queryLower)) {
        score += 20
      }
      
      // Category match
      if (categoryLower.includes(queryLower) || queryLower.includes(categoryLower)) {
        score += 15
      }
      
      // Size extraction and matching
      let selectedSize: string | undefined
      if (extractedSize && product.sizes && product.sizes.length > 0) {
        // Try to find matching size
        if (extractedSize.includes('XL') || extractedSize.includes('XXL')) {
          selectedSize = product.sizes.find(s => s.includes('XL') || s.includes('XXL')) || product.sizes[0]
        } else if (extractedSize.includes('L') && !extractedSize.includes('X')) {
          selectedSize = product.sizes.find(s => s.includes('L') && !s.includes('X')) || product.sizes[0]
        } else if (extractedSize.includes('M') && !extractedSize.includes('L')) {
          selectedSize = product.sizes.find(s => s.includes('M') && !s.includes('L')) || product.sizes[0]
        } else if (extractedSize.includes('S') && !extractedSize.includes('M')) {
          selectedSize = product.sizes.find(s => s.includes('S') && !s.includes('M')) || product.sizes[0]
        } else {
          selectedSize = product.sizes[0]
        }
      } else if (product.sizes && product.sizes.length > 0) {
        selectedSize = product.sizes[0]
      }
      
      if (score > 0) {
        results.push({ product, selectedSize, score })
      }
    }
    
    // Sort by score descending and return top matches
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  // Parse product data from assistant message and return top matches
  const parseProductsFromMessage = (content: string, productData?: { productId?: string; productName?: string; selectedSize?: string }): Array<{ product: Product; selectedSize?: string }> => {
    const results: Array<{ product: Product; selectedSize?: string }> = []
    
    // First check if productData was provided in the response
    if (productData?.productId) {
      const product = products.find(p => p.id === productData.productId)
      if (product) {
        results.push({ product, selectedSize: productData.selectedSize })
        return results
      }
    }
    
    if (productData?.productName) {
      const product = products.find(p => 
        p.name.toLowerCase().includes(productData.productName!.toLowerCase()) ||
        productData.productName!.toLowerCase().includes(p.name.toLowerCase())
      )
      if (product) {
        results.push({ product, selectedSize: productData.selectedSize })
        return results
      }
    }

    // Use search function to find products from message content
    // Extract search terms from content (remove common words)
    const contentLower = content.toLowerCase()
    const searchTerms = contentLower
      .replace(/\b(here|is|are|the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|as|I|you|he|she|it|we|they|this|that|these|those|would|like|to|add|cart|my|your|our|their|some|any|all|each|every|more|most|other|another|such|same|different|few|little|much|many|very|too|so|also|just|only|even|still|yet|already|now|then|when|where|why|how|what|which|who|whom|whose|can|could|should|will|would|may|might|must|shall)\b/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .join(' ')
    
    if (searchTerms) {
      const searchResults = searchProducts(searchTerms, 3)
      return searchResults.map(r => ({ product: r.product, selectedSize: r.selectedSize }))
    }
    
    // Fallback: look for any product mentions in content
    for (const product of products) {
      const productNameLower = product.name.toLowerCase()
      if (contentLower.includes(productNameLower)) {
        // Extract size if mentioned
        let selectedSize: string | undefined
        const sizeMatch = content.match(/\b(size|Size|SIZE)\s*:?\s*([SMXL]+|Small|Medium|Large|Extra\s*Large)\b/i)
        if (sizeMatch && product.sizes && product.sizes.length > 0) {
          const sizeValue = sizeMatch[2]
          if (sizeValue.toUpperCase().includes('XL') || sizeValue.toUpperCase().includes('XXL')) {
            selectedSize = product.sizes.find(s => s.includes('XL') || s.includes('XXL')) || product.sizes[0]
          } else if (sizeValue.toUpperCase().includes('L') && !sizeValue.toUpperCase().includes('X')) {
            selectedSize = product.sizes.find(s => s.includes('L') && !s.includes('X')) || product.sizes[0]
          } else if (sizeValue.toUpperCase().includes('M') && !sizeValue.toUpperCase().includes('L')) {
            selectedSize = product.sizes.find(s => s.includes('M') && !s.includes('L')) || product.sizes[0]
          } else if (sizeValue.toUpperCase().includes('S') && !sizeValue.toUpperCase().includes('M')) {
            selectedSize = product.sizes.find(s => s.includes('S') && !s.includes('M')) || product.sizes[0]
          } else {
            selectedSize = product.sizes[0]
          }
        } else if (product.sizes && product.sizes.length > 0) {
          selectedSize = product.sizes[0]
        }
        
        results.push({ product, selectedSize })
        if (results.length >= 3) break
      }
    }
    
    return results
  }

  const sendMessage = async () => {
    if (!message.trim() || isLoading || !isEnabled) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsLoading(true)
    setMetrics(null) // Reset metrics for new message
    setSuggestedProducts([]) // Clear suggested products when user sends new message

    try {
      // Prepare chat history for API
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
        id: m.id,
      }))

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userInput: userMessage.content,
          chatHistory,
          aiConfigKey,
        }),
      })

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = "Failed to send message"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""
      const assistantMessageId = Date.now().toString()

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ])

      if (reader) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.chunk) {
                  assistantMessage += data.chunk
                  // Update the assistant message with streaming content
                  setMessages((prev) => {
                    return prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: assistantMessage }
                        : msg
                    )
                  })
                }
                if (data.done) {
                  // Store metrics from response
                  if (data.modelName || data.timing || data.tokens) {
                    setMetrics({
                      modelName: data.modelName,
                      modelType: data.modelType,
                      timing: data.timing,
                      tokens: data.tokens,
                    })
                  }
                  
                  // Only show products if user's message is product-related
                  if (isProductQuery(userMessage.content)) {
                    // Check for product data in response and show top 3 matches
                    const parsedProducts = parseProductsFromMessage(assistantMessage, data.productData)
                    if (parsedProducts.length > 0) {
                      setSuggestedProducts(parsedProducts)
                    } else {
                      // Search products based on user's actual query
                      const searchResults = searchProducts(userMessage.content, 3)
                      if (searchResults.length > 0) {
                        setSuggestedProducts(searchResults.map(r => ({ product: r.product, selectedSize: r.selectedSize })))
                      } else {
                        setSuggestedProducts([])
                      }
                    }
                  } else {
                    // Clear products if not a product query
                    setSuggestedProducts([])
                  }
                  
                  setIsLoading(false)
                  return
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }

      // Ensure we have an assistant message
      if (!assistantMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "I apologize, but I'm having trouble processing your request. Please try again.",
                }
              : msg
          )
        )
        setSuggestedProducts([])
      } else {
        // Only show products if user's message is product-related
        if (isProductQuery(userMessage.content)) {
          // Try to parse products from final message
          const parsed = parseProductsFromMessage(assistantMessage)
          if (parsed.length > 0) {
            setSuggestedProducts(parsed)
          } else {
            // Search products based on user's actual query
            const searchResults = searchProducts(userMessage.content, 3)
            if (searchResults.length > 0) {
              setSuggestedProducts(searchResults.map(r => ({ product: r.product, selectedSize: r.selectedSize })))
            } else {
              setSuggestedProducts([])
            }
          }
        } else {
          // Clear products if not a product query
          setSuggestedProducts([])
        }
      }
      setIsLoading(false)
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      
      // Show error to user first
      const errorMessage = errorObj.message || "Sorry, I encountered an error. Please try again."
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: errorMessage.includes("AI config is disabled") 
            ? "The chatbot is currently disabled. Please try again later."
            : errorMessage,
        },
      ])
      
      // Log error for structured logging
      logger.error(
        "Error sending chat message",
        errorObj,
        {
          component: "ChatBot",
          aiConfigKey,
          endpoint: "/api/chat",
        }
      )
      
      // Record error to LaunchDarkly observability
      recordErrorToLD(
        errorObj,
        "Error sending chat message",
        {
          component: "ChatBot",
          aiConfigKey,
          endpoint: "/api/chat",
        }
      )
      
      // Throw error asynchronously for LaunchDarkly observability to track
      // Using setTimeout ensures UI updates (error message) are shown first
      setTimeout(() => {
        throw errorObj
      }, 0)
    } finally {
      setIsLoading(false)
    }
  }

  // Self-Healing message function - routes to /api/chat/self-healing
  const sendSelfHealingMessage = async () => {
    if (!message.trim() || isLoading || !isSelfHealingEnabled) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message.trim(),
    }

    setSelfHealingMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsLoading(true)
    setLoadingStatus("Initializing...")
    setSelfHealingMetrics(null)
    setSelfHealingSuggestedProducts([])

    try {
      // Prepare chat history for API
      const chatHistory = selfHealingMessages.map((m) => ({
        role: m.role,
        content: m.content,
        id: m.id,
      }))

      const response = await fetch("/api/chat/self-healing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userInput: userMessage.content,
          chatHistory,
          aiConfigKey: selfHealingAiConfigKey,
          enableFallback, // Pass the toggle state to control whether fallback runs
        }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to send message"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""
      const assistantMessageId = Date.now().toString()

      if (reader) {
        let buffer = ""
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (data.status) {
                    setLoadingStatus(data.status)
                  }

                  // Check for errors in the stream first
                  if (data.error) {
                    throw new Error(data.error)
                  }

                  if (data.chunk) {
                    assistantMessage += data.chunk
                    setSelfHealingMessages((prev) => {
                      const exists = prev.some(msg => msg.id === assistantMessageId)
                      if (exists) {
                        return prev.map((msg) =>
                          msg.id === assistantMessageId
                            ? { ...msg, content: assistantMessage }
                            : msg
                        )
                      }
                      return [...prev, { id: assistantMessageId, role: "assistant", content: assistantMessage }]
                    })
                  }
                  
                  if (data.done) {
                    // Store metrics from response including judge scores
                    if (data.modelName || data.timing || data.tokens || data.judgeScores) {
                      setSelfHealingMetrics({
                        modelName: data.modelName,
                        modelType: data.modelType,
                        timing: data.timing,
                        tokens: data.tokens,
                        judgeScores: data.judgeScores,
                        didFallback: data.didFallback,
                      })
                    }

                    // Add judge scores message if fallback occurred
                    if (data.didFallback && data.judgeScores) {
                      const judgeMessage: Message = {
                        id: Date.now().toString() + "-judge",
                        role: "judge",
                        content: `🔍 **AI Judge Evaluation**\n\n**Initial Model Scores (${data.originalModel || "Unknown Model"}):**\n- Accuracy: ${data.judgeScores.before?.accuracy?.toFixed(1) || "N/A"}%\n- Relevance: ${data.judgeScores.before?.relevance?.toFixed(1) || "N/A"}%\n\n**Original Response (Reverted):**\n> ${data.originalResponse || "No response captured"}\n\n**Fallback Model Scores (Passed):**\n- Accuracy: ${data.judgeScores.after?.accuracy?.toFixed(1) || "N/A"}%\n- Relevance: ${data.judgeScores.after?.relevance?.toFixed(1) || "N/A"}%\n\n✅ Self-healed to: **${data.modelName}**`,
                        judgeScores: data.judgeScores,
                      }
                      setSelfHealingMessages((prev) => [...prev, judgeMessage])
                      
                      // Add reset prompt after self-healing demo completes
                      setTimeout(() => {
                        const resetPrompt: Message = {
                          id: Date.now().toString() + "-reset",
                          role: "assistant",
                          content: "The self-healing demo is complete. Would you like to reset the context to try again?",
                        }
                        setSelfHealingMessages((prev) => [...prev, resetPrompt])
                      }, 1000)
                    }
                    
                    // Show judge message when fallback was skipped (bad response only mode)
                    if (data.fallbackSkipped && data.judgeScores) {
                      const judgeMessage: Message = {
                        id: Date.now().toString() + "-judge",
                        role: "judge",
                        content: `🔍 **AI Judge Evaluation**\n\n**Model Scores (${data.modelName || "Unknown Model"}):**\n- Accuracy: ${data.judgeScores.before?.accuracy?.toFixed(1) || "N/A"}%\n- Relevance: ${data.judgeScores.before?.relevance?.toFixed(1) || "N/A"}%\n\n⚠️ **Scores below threshold (90%)** - Self-healing is disabled.\n\n💡 Enable fallback in Options to see the self-healing behavior.`,
                        judgeScores: data.judgeScores,
                      }
                      setSelfHealingMessages((prev) => [...prev, judgeMessage])
                    }
                    
                    // Handle products
                    if (isProductQuery(userMessage.content)) {
                      const parsedProducts = parseProductsFromMessage(assistantMessage, data.productData)
                      if (parsedProducts.length > 0) {
                        setSelfHealingSuggestedProducts(parsedProducts)
                      } else {
                        const searchResults = searchProducts(userMessage.content, 3)
                        if (searchResults.length > 0) {
                          setSelfHealingSuggestedProducts(searchResults.map(r => ({ product: r.product, selectedSize: r.selectedSize })))
                        }
                      }
                    }
                    
                    setIsLoading(false)
                    return
                  }
                } catch (parseError) {
                  // If it's an error we intentionally threw (data.error), rethrow it
                  if (parseError instanceof Error && parseError.message && !parseError.message.includes("Unexpected token")) {
                    throw parseError
                  }
                  // Otherwise, ignore JSON parse errors
                }
              }
            }
          }
        } catch (streamError) {
          // Re-throw stream errors to outer catch block
          throw streamError
        }
      }

      if (!assistantMessage) {
        setSelfHealingMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "I apologize, but I'm having trouble processing your request. Please try again.",
          }
        ])
      }
      setIsLoading(false)
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      
      // Show error message with restart option (except for disabled config)
      const isDisabled = errorObj.message.includes("AI config is disabled")
      const errorMessage = isDisabled
        ? "The chatbot is currently disabled. Please try again later."
        : errorObj.message || "Sorry, I encountered an error. Please try again."
      
      setSelfHealingMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: isDisabled 
            ? errorMessage
            : `${errorMessage}\n\nThe self-healing chatbot encountered an error. Would you like to restart and try again?`,
        },
      ])
      
      logger.error("Error sending self-healing chat message", errorObj, {
        component: "ChatBot",
        aiConfigKey: selfHealingAiConfigKey,
        endpoint: "/api/chat/self-healing",
      })
      
      recordErrorToLD(errorObj, "Error sending self-healing chat message", {
        component: "ChatBot",
        aiConfigKey: selfHealingAiConfigKey,
        endpoint: "/api/chat/self-healing",
      })
    } finally {
      setIsLoading(false)
    }
  }


  // Suggested prompts for self-healing chat
  const SUGGESTED_PROMPTS = [
    "What is ToggleStore?",
  ]

  // Reset AI context for self-healing
  const resetSelfHealing = async () => {
    try {
      setIsLoading(true)
      
      // Call API to reset fallback context
      await fetch("/api/chat/reset", { method: "POST" })
      
      // Reset UI state
      setSelfHealingMessages([SELF_HEALING_INITIAL_MESSAGE])
      setSelfHealingMetrics(null)
      setSelfHealingSuggestedProducts([])
      setMessage("")
      
      // Force context refresh via LoginContext if available (optional)
      // This might not be needed if we just reset local state, but good for consistency
      
    } catch (error) {
      console.error("Failed to reset self-healing context", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (activeTab === "experiment") {
        sendMessage()
      } else {
        sendSelfHealingMessage()
      }
    }
  }

  return (
    <>
      {/* Chatbot Icon Button */}
      <button
        onClick={() => {
          setOpen(true)
          trackMetric("chatbot-accessed")
        }}
        className="fixed bottom-8 right-8 md:right-[50px] lg:right-[50px] w-[96px] h-[96px] rounded-full border border-[#58595B] transition-colors flex items-center justify-center z-50 overflow-hidden group chatbot-button-gradient-flow"
        aria-label="Open chatbot"
        data-dev-highlight="chatbot"
        style={{ position: 'fixed' }}
      >
        {/* Overlay for hover black shade */}
        <span className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-150 opacity-0 group-hover:opacity-20 bg-black" />
        <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
          <Image
            src="/assets/chatbot/toggle-mascot.png"
            alt="ToggleBot"
            width={150}
            height={182}
            className="object-cover scale-[1.4] mt-10 mr-3 object-center"
            unoptimized
          />
        </div>
      </button>

      {/* Chat Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[calc(100vw-2rem)]! h-auto! min-h-[400px]! max-h-[calc(100vh-4rem)]! sm:w-[min(433px,calc(100vw-2rem))]! sm:min-h-[582px]! sm:max-h-[min(582px,calc(100vh-4rem))]! md:w-[min(900px,calc(100vw-2rem))]! md:max-h-[calc(100vh-4rem)]! lg:w-[min(1200px,calc(100vw-2rem))]! lg:max-h-[calc(100vh-4rem)]! max-w-[calc(100vw-2rem)]! rounded-[30px] border border-[#58595B] p-0 overflow-hidden flex flex-col"
          style={{
            backgroundImage:
              "linear-gradient(179.99999980063217deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
            maxHeight: "calc(100vh - 4rem)",
          }}
          showCloseButton={false}
        >
          {/* Header */}
          <div className="relative border-b border-[#ebff38] border-l-0 border-r-0 border-t-0">
            <div className="h-[89px] md:h-[100px] lg:h-[110px] flex items-center justify-center">
              <h2
                className="text-[24px] md:text-[28px] lg:text-[32px] font-mono font-bold leading-[1.4] text-white"
              >
                ToggleBot
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="absolute right-[32px] md:right-[40px] lg:right-[48px] w-[36px] h-[36px] md:w-[40px] md:h-[40px] lg:w-[44px] lg:h-[44px] rounded-full border border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors"
                aria-label="Close chatbot"
              >
                <Image
                  src="/assets/chatbot/close.svg"
                  alt="Close"
                  width={21}
                  height={21}
                  className="object-contain"
                  unoptimized
                />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="px-[16px] sm:px-[24px] md:px-[32px] lg:px-[40px]">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChatTab)} className="w-full">
                <TabsList 
                  className="border-b border-[#58595B] gap-0 w-full flex relative"
                  style={{ position: 'relative' }}
                >
                  {/* Divider line in the middle - more visible */}
                  <div 
                    className="pointer-events-none"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '4px',
                      bottom: '4px',
                      width: '1px',
                      backgroundColor: '#414042',
                      zIndex: 20,
                      transform: 'translateX(-50%)',
                    }}
                  />
                  
                  <TabsTrigger 
                    value="experiment" 
                    className="flex-1 font-mono transition-all duration-300 relative px-0"
                    style={{
                      backgroundColor: 'transparent',
                      borderBottom: 'none',
                      border: 'none',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      fontSize: 'clamp(12px, 2.5vw, 18px)',
                      lineHeight: '1.4',
                    }}
                  >
                    <span 
                      className="relative z-10 block text-center"
                      style={
                        activeTab === "experiment"
                          ? {
                              color: '#A855F7',
                              fontWeight: 'bold',
                            } as React.CSSProperties
                          : {
                              color: '#A7A9AC',
                              fontWeight: 'normal',
                              opacity: 0.6,
                            }
                      }
                    >
                      <span className="block sm:hidden">Experiment</span>
                      <span className="hidden sm:block">AI Model Experiment</span>
                    </span>
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="self-healing" 
                    className="flex-1 font-mono transition-all duration-300 relative px-0"
                    style={{
                      backgroundColor: 'transparent',
                      borderBottom: 'none',
                      border: 'none',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      fontSize: 'clamp(12px, 2.5vw, 18px)',
                      lineHeight: '1.4',
                    }}
                  >
                    <span 
                      className="relative z-10 block text-center"
                      style={
                        activeTab === "self-healing"
                          ? {
                              color: '#ebff38',
                              fontWeight: 'bold',
                            } as React.CSSProperties
                          : {
                              color: '#A7A9AC',
                              fontWeight: 'normal',
                              opacity: 0.6,
                            }
                      }
                    >
                      <span className="block sm:hidden">Self-Healing</span>
                      <span className="hidden sm:block">AI Self-Healing</span>
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {/* Metrics Display - Experiment Tab */}
            {activeTab === "experiment" && isEnabled && (flag?.model?.name || metrics) && (
              <div className="px-[32px] md:px-[40px] lg:px-[48px] pb-[12px] md:pb-[16px] lg:pb-[20px] border-t border-[#58595B]/30">
                <div className="flex flex-col gap-2 md:gap-3 lg:gap-4 pt-[8px] md:pt-[10px] lg:pt-[12px]">
                  {(metrics?.modelName || flag?.model?.name) && (
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                      <span className="text-[16px] md:text-[18px] lg:text-[20px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                        Model:
                      </span>
                      <span className="text-[16px] md:text-[18px] lg:text-[20px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                        {metrics?.modelName || flag?.model?.name}
                      </span>
                    </div>
                  )}
                  {metrics && (
                    <div className="flex items-center gap-6 md:gap-8 lg:gap-10">
                      {metrics.timing?.totalTime !== undefined && (
                        <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                          <span className="text-[16px] md:text-[18px] lg:text-[20px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                            Time:
                          </span>
                          <span className="text-[16px] md:text-[18px] lg:text-[20px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                            {metrics.timing.totalTime}ms
                          </span>
                        </div>
                      )}
                      {metrics.tokens?.total !== undefined && (
                        <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                          <span className="text-[16px] md:text-[18px] lg:text-[20px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                            Tokens:
                          </span>
                          <span className="text-[16px] md:text-[18px] lg:text-[20px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                            {metrics.tokens.total} ({metrics.tokens.input || 0} in / {metrics.tokens.output || 0} out)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Metrics Display - Self-Healing Tab */}
            {activeTab === "self-healing" && isSelfHealingEnabled && (
              <div className="px-[32px] md:px-[40px] lg:px-[48px] pb-[12px] md:pb-[16px] lg:pb-[20px] border-t border-[#58595B]/30">
                <div className="flex flex-col gap-2 md:gap-3 lg:gap-4 pt-[8px] md:pt-[10px] lg:pt-[12px]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 flex-wrap">
                      {(selfHealingMetrics?.modelName || selfHealingFlag?.model?.name) && (
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] md:text-[16px] lg:text-[18px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                            Model:
                          </span>
                          <span className="text-[14px] md:text-[16px] lg:text-[18px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                            {selfHealingMetrics?.modelName || selfHealingFlag?.model?.name}
                          </span>
                        </div>
                      )}
                      {selfHealingMetrics?.didFallback && (
                        <span className="px-2 py-1 bg-[#ebff38]/20 text-[#ebff38] font-sohne text-[14px] md:text-[20px] rounded-full">
                          Self-Healed ✅
                        </span>
                      )}
                    </div>
                    
                    {/* Settings Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                        className="flex items-center gap-1 px-2 py-1 text-[12px] md:text-[14px] text-[#A7A9AC] hover:text-white transition-colors rounded border border-[#58595B] hover:border-[#7084FF]"
                        aria-label="Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        <span className="hidden sm:inline">Options</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showSettingsDropdown ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      
                      {showSettingsDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-[220px] bg-[#212121] border border-[#58595B] rounded-lg shadow-lg z-50 overflow-hidden">
                          <div className="p-3 border-b border-[#58595B]/50">
                            <span className="text-[12px] text-[#A7A9AC] uppercase tracking-wider">Demo Mode</span>
                          </div>
                          <div className="p-2">
                            <button
                              onClick={() => {
                                setEnableFallback(!enableFallback)
                                setShowSettingsDropdown(false)
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#333] rounded transition-colors"
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-[14px] text-white">Enable Fallback</span>
                                <span className="text-[11px] text-[#A7A9AC]">
                                  {enableFallback ? "Shows self-healing" : "Bad response only"}
                                </span>
                              </div>
                              <div 
                                className={`w-10 h-5 rounded-full transition-colors relative ${enableFallback ? 'bg-[#ebff38]' : 'bg-[#58595B]'}`}
                              >
                                <div 
                                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enableFallback ? 'translate-x-5' : 'translate-x-0.5'}`}
                                />
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selfHealingMetrics && (
                    <div className="flex items-center gap-6 md:gap-8 lg:gap-10 flex-wrap">
                      {selfHealingMetrics.timing?.totalTime !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] md:text-[16px] lg:text-[18px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                            Time:
                          </span>
                          <span className="text-[14px] md:text-[16px] lg:text-[18px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                            {selfHealingMetrics.timing.totalTime}ms
                          </span>
                        </div>
                      )}
                      {selfHealingMetrics.tokens?.total !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] md:text-[16px] lg:text-[18px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                            Tokens:
                          </span>
                          <span className="text-[14px] md:text-[16px] lg:text-[18px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                            {selfHealingMetrics.tokens.total}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages Area - Experiment Tab */}
          {activeTab === "experiment" && (
            <div className="flex-1 overflow-y-auto px-[32px] md:px-[40px] lg:px-[48px] py-[16px] md:py-[20px] lg:py-[24px] space-y-4 md:space-y-5 lg:space-y-6 mb-[100px] md:mb-[120px] lg:mb-[140px]">
              {!isEnabled && (
                <div className="flex justify-center items-center h-full">
                  <div className="bg-[rgba(33,33,33,0.5)] border border-[#58595B] rounded-[10px] p-[24px] md:p-[28px] lg:p-[32px] max-w-[280px] md:max-w-[400px] lg:max-w-[500px] text-center">
                    <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-normal text-[#A7A9AC] font-['Sohne:Buch',sans-serif]">
                      The chatbot is currently disabled. Please try again later.
                    </p>
                  </div>
                </div>
              )}
              {isEnabled && messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[280px] md:max-w-[400px] lg:max-w-[500px] rounded-[10px] p-[16px] md:p-[18px] lg:p-[20px] ${
                      msg.role === "user"
                        ? "bg-[#7084FF] text-white"
                        : "bg-[rgba(33,33,33,0.5)] border border-[#58595B] text-white"
                    }`}
                  >
                    {msg.content ? (
                      <div className="text-[16px] md:text-[17px] lg:text-[18px] leading-normal font-['Sohne:Buch',sans-serif] [&>*:not(:last-child)]:mb-2">
                        {msg.content === "The self-healing demo is complete. Would you like to reset the context to try again?" ? (
                          <div className="flex flex-col gap-3">
                            <p>{msg.content}</p>
                            <Button 
                              onClick={resetSelfHealing}
                              variant="outline"
                              className="w-full bg-transparent border border-[#ebff38] text-[#ebff38] hover:bg-[#ebff38]/10 hover:text-[#ebff38]"
                            >
                              Reset Self-Healing Demo
                            </Button>
                          </div>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>,
                              li: ({ children }) => <li>{children}</li>,
                              code: ({ children }) => (
                                <code className="bg-[rgba(112,132,255,0.2)] px-1 py-0.5 rounded text-[14px] md:text-[15px] lg:text-[16px] font-mono">
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className="bg-[rgba(33,33,33,0.8)] p-2 rounded overflow-x-auto mb-2 text-[14px] md:text-[15px] lg:text-[16px]">
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-[#7084FF] pl-3 italic mb-2">
                                  {children}
                                </blockquote>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#7084FF] underline hover:text-[#405BFF]"
                                >
                                  {children}
                                </a>
                              ),
                              h1: ({ children }) => <h1 className="text-[20px] md:text-[22px] lg:text-[24px] font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-[18px] md:text-[20px] lg:text-[22px] font-bold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-[16px] md:text-[18px] lg:text-[20px] font-bold mb-2">{children}</h3>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#7084FF] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-[#7084FF] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-[#7084FF] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* Show mini product cards for top 3 suggested products */}
              {isEnabled && suggestedProducts.length > 0 && onAddToCart && (
                <div className="flex flex-col gap-3">
                  {suggestedProducts.map((item, index) => (
                    <div key={`${item.product.id}-${index}`} className="flex justify-start">
                      <div className="max-w-[280px] md:max-w-[400px] lg:max-w-[500px] w-full">
                        <MiniProductCard
                          product={item.product}
                          selectedSize={item.selectedSize}
                          onAddToCart={(product, quantity, size) => {
                            onAddToCart(product, quantity, size)
                            // Remove this product from suggestions after adding
                            setSuggestedProducts(prev => prev.filter(p => p.product.id !== product.id))
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Loading indicator when processing - show when waiting for response */}
              {isEnabled && isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[280px] md:max-w-[400px] lg:max-w-[500px] rounded-[10px] p-[16px] md:p-[18px] lg:p-[20px] bg-[rgba(33,33,33,0.5)] border border-[#58595B]">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div 
                        className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#7084FF]"
                        style={{
                          animation: 'bounce 1.4s ease-in-out infinite',
                          animationDelay: '0ms'
                        }}
                      />
                      <div 
                        className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#7084FF]"
                        style={{
                          animation: 'bounce 1.4s ease-in-out infinite',
                          animationDelay: '160ms'
                        }}
                      />
                      <div 
                        className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#7084FF]"
                        style={{
                          animation: 'bounce 1.4s ease-in-out infinite',
                          animationDelay: '320ms'
                        }}
                      />
                      <style dangerouslySetInnerHTML={{__html: `
                        @keyframes bounce {
                          0%, 60%, 100% {
                            transform: translateY(0);
                          }
                          30% {
                            transform: translateY(-10px);
                          }
                        }
                      `}} />
                    </div>
                  </div>
                </div>
              )}
              {isEnabled && <div ref={messagesEndRef} />}
            </div>
          )}

          {/* Messages Area - Self-Healing Tab */}
          {activeTab === "self-healing" && (
            <div className="flex-1 overflow-y-auto px-[32px] md:px-[40px] lg:px-[48px] py-[16px] md:py-[20px] lg:py-[24px] space-y-4 md:space-y-5 lg:space-y-6 mb-[100px] md:mb-[120px] lg:mb-[140px]">
              {!isSelfHealingEnabled && (
                <div className="flex justify-center items-center h-full">
                  <div className="bg-[rgba(33,33,33,0.5)] border border-[#58595B] rounded-[10px] p-[24px] md:p-[28px] lg:p-[32px] max-w-[280px] md:max-w-[400px] lg:max-w-[500px] text-center">
                    <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-normal text-[#A7A9AC] font-['Sohne:Buch',sans-serif]">
                      The self-healing chatbot is currently disabled. Please try again later.
                    </p>
                  </div>
                </div>
              )}
              {isSelfHealingEnabled && selfHealingMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[280px] md:max-w-[400px] lg:max-w-[500px] rounded-[10px] p-[16px] md:p-[18px] lg:p-[20px] ${
                      msg.role === "user"
                        ? "bg-[#7084FF] text-white"
                        : msg.role === "judge"
                        ? "bg-[rgba(235,255,56,0.1)] border border-[#ebff38] text-white"
                        : "bg-[rgba(33,33,33,0.5)] border border-[#58595B] text-white"
                    }`}
                  >
                    {msg.content ? (
                      <div className="text-[16px] md:text-[17px] lg:text-[18px] leading-normal font-['Sohne:Buch',sans-serif] [&>*:not(:last-child)]:mb-2">
                        {msg.content === "The self-healing demo is complete. Would you like to reset the context to try again?" || 
                         msg.content.includes("Would you like to restart and try again?") ? (
                          <div className="flex flex-col gap-3">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>,
                                li: ({ children }) => <li>{children}</li>,
                                code: ({ children }) => (
                                  <code className="bg-[rgba(112,132,255,0.2)] px-1 py-0.5 rounded text-[14px] md:text-[15px] lg:text-[16px] font-mono">
                                    {children}
                                  </code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="bg-[rgba(33,33,33,0.8)] p-2 rounded overflow-x-auto mb-2 text-[14px] md:text-[15px] lg:text-[16px]">
                                    {children}
                                  </pre>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-2 border-[#7084FF] pl-3 italic mb-2">
                                    {children}
                                  </blockquote>
                                ),
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#7084FF] underline hover:text-[#405BFF]"
                                  >
                                    {children}
                                  </a>
                                ),
                                h1: ({ children }) => <h1 className="text-[20px] md:text-[22px] lg:text-[24px] font-bold mb-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-[18px] md:text-[20px] lg:text-[22px] font-bold mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-[16px] md:text-[18px] lg:text-[20px] font-bold mb-2">{children}</h3>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                            <Button 
                              onClick={resetSelfHealing}
                              variant="outline"
                              className="w-full bg-transparent border border-[#ebff38] text-[#ebff38] hover:bg-[#ebff38]/10 hover:text-[#ebff38]"
                            >
                              {msg.content.includes("error") || msg.content.includes("Error") ? "Restart Chat" : "Reset Self-Healing Demo"}
                            </Button>
                          </div>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>,
                              li: ({ children }) => <li>{children}</li>,
                              code: ({ children }) => (
                                <code className="bg-[rgba(112,132,255,0.2)] px-1 py-0.5 rounded text-[14px] md:text-[15px] lg:text-[16px] font-mono">
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className="bg-[rgba(33,33,33,0.8)] p-2 rounded overflow-x-auto mb-2 text-[14px] md:text-[15px] lg:text-[16px]">
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-[#7084FF] pl-3 italic mb-2">
                                  {children}
                                </blockquote>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#7084FF] underline hover:text-[#405BFF]"
                                >
                                  {children}
                                </a>
                              ),
                              h1: ({ children }) => <h1 className="text-[20px] md:text-[22px] lg:text-[24px] font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-[18px] md:text-[20px] lg:text-[22px] font-bold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-[16px] md:text-[18px] lg:text-[20px] font-bold mb-2">{children}</h3>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#7084FF] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-[#7084FF] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-[#7084FF] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Suggested Prompts for Self-Healing */}
              {isSelfHealingEnabled && selfHealingMessages.length === 1 && (
                <div className="grid grid-cols-1 gap-2 mt-4">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setMessage(prompt)
                        // Tiny delay to ensure state updates before sending
                        setTimeout(() => {
                          if (activeTab === "self-healing") {
                            // We need to call this directly because setMessage is async
                            // and we can't rely on 'message' state immediately
                            const userMessage: Message = {
                              id: Date.now().toString(),
                              role: "user",
                              content: prompt,
                            }
                            setSelfHealingMessages((prev) => [...prev, userMessage])
                            setMessage("")
                            setIsLoading(true)
                            setSelfHealingMetrics(null)
                            setSelfHealingSuggestedProducts([])
                            
                            // Re-implementing send logic specifically for prompt clicks
                            // because calling sendSelfHealingMessage() would use stale 'message' state
                            const sendPrompt = async () => {
                              try {
                                const chatHistory = [...selfHealingMessages, userMessage].map((m) => ({
                                  role: m.role,
                                  content: m.content,
                                  id: m.id,
                                }))

                                const response = await fetch("/api/chat/self-healing", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    userInput: prompt,
                                    chatHistory,
                                    aiConfigKey: selfHealingAiConfigKey,
                                    enableFallback, // Pass the toggle state
                                  }),
                                })

                                if (!response.ok) throw new Error("Failed to send message")

                                const reader = response.body?.getReader()
                                const decoder = new TextDecoder()
                                let assistantMessage = ""
                                const assistantMessageId = Date.now().toString()

                                if (reader) {
                                  let buffer = ""
                                  while (true) {
                                    const { done, value } = await reader.read()
                                    if (done) break
                                    buffer += decoder.decode(value, { stream: true })
                                    const lines = buffer.split("\n")
                                    buffer = lines.pop() || ""
                                    for (const line of lines) {
                                      if (line.startsWith("data: ")) {
                                        try {
                                          const data = JSON.parse(line.slice(6))
                                          
                                          if (data.status) {
                                            setLoadingStatus(data.status)
                                          }

                                          if (data.chunk) {
                                            assistantMessage += data.chunk
                                            setSelfHealingMessages((prev) => {
                                              const exists = prev.some(msg => msg.id === assistantMessageId)
                                              if (exists) {
                                                return prev.map((msg) =>
                                                  msg.id === assistantMessageId
                                                    ? { ...msg, content: assistantMessage }
                                                    : msg
                                                )
                                              }
                                              return [...prev, { id: assistantMessageId, role: "assistant", content: assistantMessage }]
                                            })
                                          }
                                          if (data.done) {
                                            if (data.modelName || data.timing || data.tokens || data.judgeScores) {
                                              setSelfHealingMetrics({
                                                modelName: data.modelName,
                                                modelType: data.modelType,
                                                timing: data.timing,
                                                tokens: data.tokens,
                                                judgeScores: data.judgeScores,
                                                didFallback: data.didFallback,
                                              })
                                            }
                                            if (data.didFallback && data.judgeScores) {
                                              const judgeMessage: Message = {
                                                id: Date.now().toString() + "-judge",
                                                role: "judge",
                                                content: `🔍 **AI Judge Evaluation**\n\n**Initial Model Scores (${data.originalModel || "Unknown Model"}):**\n- Accuracy: ${data.judgeScores.before?.accuracy?.toFixed(1) || "N/A"}%\n- Relevance: ${data.judgeScores.before?.relevance?.toFixed(1) || "N/A"}%\n\n**Original Response (Reverted):**\n> ${data.originalResponse || "No response captured"}\n\n**Fallback Model Scores (Passed):**\n- Accuracy: ${data.judgeScores.after?.accuracy?.toFixed(1) || "N/A"}%\n- Relevance: ${data.judgeScores.after?.relevance?.toFixed(1) || "N/A"}%\n\n✅ Self-healed to: **${data.modelName}**`,
                                                judgeScores: data.judgeScores,
                                              }
                                              setSelfHealingMessages((prev) => [...prev, judgeMessage])
                                              setTimeout(() => {
                                                const resetPrompt: Message = {
                                                  id: Date.now().toString() + "-reset",
                                                  role: "assistant",
                                                  content: "The self-healing demo is complete. Would you like to reset the context to try again?",
                                                }
                                                setSelfHealingMessages((prev) => [...prev, resetPrompt])
                                              }, 1000)
                                            }
                                            
                                            // Show judge message when fallback was skipped (bad response only mode)
                                            if (data.fallbackSkipped && data.judgeScores) {
                                              const judgeMessage: Message = {
                                                id: Date.now().toString() + "-judge",
                                                role: "judge",
                                                content: `🔍 **AI Judge Evaluation**\n\n**Model Scores (${data.modelName || "Unknown Model"}):**\n- Accuracy: ${data.judgeScores.before?.accuracy?.toFixed(1) || "N/A"}%\n- Relevance: ${data.judgeScores.before?.relevance?.toFixed(1) || "N/A"}%\n\n⚠️ **Scores below threshold (90%)** - Self-healing is disabled.\n\n💡 Enable fallback in Options to see the self-healing behavior.`,
                                                judgeScores: data.judgeScores,
                                              }
                                              setSelfHealingMessages((prev) => [...prev, judgeMessage])
                                            }
                                            setIsLoading(false)
                                            return
                                          }
                                        } catch {}
                                      }
                                    }
                                  }
                                }
                                setIsLoading(false)
                              } catch {
                                setIsLoading(false)
                              }
                            }
                            sendPrompt()
                          }
                        }, 0)
                      }}
                      className="text-left px-4 py-3 bg-[rgba(33,33,33,0.5)] border border-[#58595B] rounded-[10px] hover:bg-[#333] hover:border-[#7084FF] transition-all duration-200 group"
                    >
                      <span className="text-[14px] md:text-[16px] text-[#A7A9AC] group-hover:text-white font-mono">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {/* Show mini product cards for self-healing tab */}
              {isSelfHealingEnabled && selfHealingSuggestedProducts.length > 0 && onAddToCart && (
                <div className="flex flex-col gap-3">
                  {selfHealingSuggestedProducts.map((item, index) => (
                    <div key={`${item.product.id}-${index}`} className="flex justify-start">
                      <div className="max-w-[280px] md:max-w-[400px] lg:max-w-[500px] w-full">
                        <MiniProductCard
                          product={item.product}
                          selectedSize={item.selectedSize}
                          onAddToCart={(product, quantity, size) => {
                            onAddToCart(product, quantity, size)
                            setSelfHealingSuggestedProducts(prev => prev.filter(p => p.product.id !== product.id))
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Loading indicator when processing - show when waiting for response */}
              {isSelfHealingEnabled && isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[280px] md:max-w-[400px] lg:max-w-[500px] rounded-[10px] p-[16px] md:p-[18px] lg:p-[20px] bg-[rgba(33,33,33,0.5)] border border-[#58595B]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <div 
                          className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#7084FF]"
                          style={{
                            animation: 'bounce 1.4s ease-in-out infinite',
                            animationDelay: '0ms'
                          }}
                        />
                        <div 
                          className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#7084FF]"
                          style={{
                            animation: 'bounce 1.4s ease-in-out infinite',
                            animationDelay: '160ms'
                          }}
                        />
                        <div 
                          className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#7084FF]"
                          style={{
                            animation: 'bounce 1.4s ease-in-out infinite',
                            animationDelay: '320ms'
                          }}
                        />
                      </div>
                      {loadingStatus && (
                        <span className="text-[#A7A9AC] text-[14px] md:text-[15px] animate-pulse font-['Sohne:Buch',sans-serif]">
                          {loadingStatus}
                        </span>
                      )}
                    </div>
                    <style dangerouslySetInnerHTML={{__html: `
                      @keyframes bounce {
                        0%, 60%, 100% {
                          transform: translateY(0);
                        }
                        30% {
                          transform: translateY(-10px);
                        }
                      }
                    `}} />
                  </div>
                </div>
              )}
              {isSelfHealingEnabled && <div ref={selfHealingMessagesEndRef} />}
            </div>
          )}

          {/* Input Area - Fixed at bottom */}
          <div className="absolute bottom-[30px] md:bottom-[36px] lg:bottom-[40px] left-[30px] md:left-[40px] lg:left-[48px] right-[30px] md:right-[40px] lg:right-[48px] flex items-center gap-[12px] md:gap-[14px] lg:gap-[16px] z-10">
            {(activeTab === "experiment" ? isEnabled : isSelfHealingEnabled) ? (
              <>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={activeTab === "experiment" ? "Type your message..." : "Ask me anything (I'll self-heal if needed)..."}
                  disabled={isLoading}
                  className="flex-1 h-[42px] md:h-[48px] lg:h-[52px] bg-[#212121] border border-[#414042] rounded-[5px] text-[#A7A9AC] placeholder:text-[#A7A9AC] text-[16px] md:text-[17px] lg:text-[18px] leading-normal px-[12px] md:px-[14px] lg:px-[16px] py-[8px] md:py-[10px] lg:py-[12px] font-['Sohne:Buch',sans-serif]"
                />
                <Button
                  onClick={activeTab === "experiment" ? sendMessage : sendSelfHealingMessage}
                  disabled={!message.trim() || isLoading}
                  className="h-[42px] md:h-[48px] lg:h-[52px] w-[42px] md:w-[48px] lg:w-[52px] rounded-[5px] p-0 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(179deg, #405BFF 1.06%, #7084FF 123.42%)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(179deg, #364DD9 1.06%, #405BFF 123.42%)"
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(179deg, #405BFF 1.06%, #7084FF 123.42%)"
                  }}
                  aria-label="Send message"
                >
                  <Image
                    src="/assets/chatbot/send.svg"
                    alt="Send"
                    width={24}
                    height={24}
                    className="object-contain brightness-0 invert md:w-[26px] md:h-[26px] lg:w-[28px] lg:h-[28px]"
                    unoptimized
                  />
                </Button>
              </>
            ) : (
              <div className="w-full bg-[#212121] border border-[#414042] rounded-[5px] px-[12px] md:px-[14px] lg:px-[16px] py-[8px] md:py-[10px] lg:py-[12px] h-[42px] md:h-[48px] lg:h-[52px] flex items-center">
                <p className="text-[#A7A9AC] text-[16px] md:text-[17px] lg:text-[18px] leading-normal font-['Sohne:Buch',sans-serif]">
                  Chatbot is disabled
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}


