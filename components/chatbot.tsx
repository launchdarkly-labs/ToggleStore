"use client"

import { useState, useRef, useEffect } from "react"
import { useFlags } from "launchdarkly-react-client-sdk"
import { useLoginContext } from "@/lib/login-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability"
import { useTrackMetric } from "@/lib/launchdarkly/metrics"
import Image from "next/image"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatBotProps {
  aiConfigKey?: string
}

interface FlagWithMeta {
  _ldMeta?: {
    enabled?: boolean
  }
  [key: string]: unknown
}

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm your ToggleStore assistant. How can I help you today?",
}

export function ChatBot({ aiConfigKey = "ai-config--togglebotchatbot" }: ChatBotProps) {
  const flags = useFlags()
  const flag = flags[aiConfigKey] as FlagWithMeta | undefined
  const { appMultiContext } = useLoginContext()
  const trackMetric = useTrackMetric()
  
  // Check if chatbot is enabled: flag?._ldMeta?.enabled !== false
  const isEnabled = flag?._ldMeta?.enabled !== false

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contextKeyRef = useRef<string | null>(null)
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clear chat history when LaunchDarkly context changes
  useEffect(() => {
    if (!appMultiContext) return

    // Generate a unique key for the current context to detect changes
    const contextUser = appMultiContext?.user as { key?: string; email?: string } | undefined
    const currentContextKey = contextUser?.key || 
                              contextUser?.email || 
                              JSON.stringify(appMultiContext)

    // If context has changed (and it's not the initial load), clear chat history
    if (contextKeyRef.current !== null && contextKeyRef.current !== currentContextKey) {
      setMessages([INITIAL_MESSAGE])
      setMetrics(null)
      setMessage("")
    }

    // Update the ref with the current context key
    contextKeyRef.current = currentContextKey
  }, [appMultiContext])

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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
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
        className="fixed bottom-8 right-8 md:right-[50px] lg:right-[50px] w-[96px] h-[96px] rounded-full border border-white transition-colors flex items-center justify-center z-50 overflow-hidden group chatbot-button-gradient-flow"
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
          className="w-[433px] h-[582px] rounded-[30px] border border-white p-0 overflow-hidden flex flex-col"
          style={{
            backgroundImage:
              "linear-gradient(179.99999980063217deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
          }}
          showCloseButton={false}
        >
          {/* Header */}
          <div className="relative border-b border-[#ebff38] border-l-0 border-r-0 border-t-0">
            <div className="h-[89px] flex items-center justify-center">
              <h2
                className="text-[24px] font-mono font-bold leading-[1.4] text-white"
              >
                ToggleBot
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="absolute right-[32px] w-[36px] h-[36px] rounded-full border border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors"
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
            {/* Metrics Display */}
            {metrics && isEnabled && (
              <div className="px-[32px] pb-[12px] border-t border-[#58595B]/30">
                <div className="flex flex-col gap-1 pt-[8px]">
                  {metrics.modelName && (
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                        Model:
                      </span>
                      <span className="text-[12px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                        {metrics.modelName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    {metrics.timing?.totalTime !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                          Time:
                        </span>
                        <span className="text-[12px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                          {metrics.timing.totalTime}ms
                        </span>
                      </div>
                    )}
                    {metrics.tokens?.total !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[#A7A9AC] font-['Sohne:Buch',sans-serif] leading-normal">
                          Tokens:
                        </span>
                        <span className="text-[12px] text-white font-['Sohne_Mono:Kräftig',sans-serif] leading-normal">
                          {metrics.tokens.total} ({metrics.tokens.input || 0} in / {metrics.tokens.output || 0} out)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-[32px] py-[16px] space-y-4 mb-[100px]">
            {!isEnabled && (
              <div className="flex justify-center items-center h-full">
                <div className="bg-[rgba(33,33,33,0.5)] border border-[#58595B] rounded-[10px] p-[24px] max-w-[280px] text-center">
                  <p className="text-[16px] leading-normal text-[#A7A9AC] font-['Sohne:Buch',sans-serif]">
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
                  className={`max-w-[280px] rounded-[10px] p-[16px] ${
                    msg.role === "user"
                      ? "bg-[#7084FF] text-white"
                      : "bg-[rgba(33,33,33,0.5)] border border-[#58595B] text-white"
                  }`}
                >
                  {msg.content ? (
                    <p className="text-[16px] leading-normal whitespace-pre-wrap font-['Sohne:Buch',sans-serif]">
                      {msg.content}
                    </p>
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
            {isEnabled && <div ref={messagesEndRef} />}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="absolute bottom-[30px] left-[30px] right-[30px] flex items-center gap-[12px] z-10">
            {isEnabled ? (
              <>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1 h-[42px] bg-[#212121] border border-[#414042] rounded-[5px] text-[#A7A9AC] placeholder:text-[#A7A9AC] text-[16px] leading-normal px-[12px] py-[8px] font-['Sohne:Buch',sans-serif]"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!message.trim() || isLoading}
                  className="h-[42px] w-[42px] rounded-[5px] p-0 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="object-contain brightness-0 invert"
                    unoptimized
                  />
                </Button>
              </>
            ) : (
              <div className="w-full bg-[#212121] border border-[#414042] rounded-[5px] px-[12px] py-[8px] h-[42px] flex items-center">
                <p className="text-[#A7A9AC] text-[16px] leading-normal font-['Sohne:Buch',sans-serif]">
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
