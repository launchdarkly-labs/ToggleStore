"use client"

import { useState, useEffect, useRef } from "react"
import { useDeveloperMode } from "@/lib/developer-mode-context"
import { Toast } from "@/components/toast"
import { Button } from "@/components/ui/button"

interface CodeSample {
  title: string
  description: string
  code: string
  language: string
}

const codeSamples: Record<string, CodeSample> = {
  search: {
    title: "Search Algorithm Feature Flag",
    description: "The search functionality uses LaunchDarkly to dynamically switch between different search algorithms.",
    language: "typescript",
    code: `// Get feature flag from LaunchDarkly
const flags = useFlags()
const searchAlgorithm = flags.searchAlgorithm as string | undefined

// Select search algorithm based on feature flag
const searchProducts = useCallback((query: string) => {
  const algorithmValue = searchAlgorithm?.toLowerCase().trim()
  const algorithm = algorithmValue === "featured-list"
    ? "featured-list"
    : "simple-search"
  
  if (algorithm === "featured-list") {
    return searchProductsFeaturedList(query)
  } else {
    return searchProductsSimpleSearch(query)
  }
}, [searchAlgorithm])`
  },
  persona: {
    title: "LaunchDarkly Context",
    description: "Build rich context with user, device, location, and experience data for intelligent feature flag targeting.",
    language: "typescript",
    code: `// Build multi-context
const context = {
  kind: 'multi',
  user: {
    key: hashedEmail,
    email: personaEmail,
    role: personaRole,
    tier: personaTier,
  },
  device: {
    key: device,
    operating_system: operatingSystem,
  },
  location: {
    key: timeZone,
    country: country,
  },
  experience: {
    key: "togglestore",
  }
}

// Identify user with context
await client.identify(context)

// Context enables targeting:
// - User attributes (role, tier)
// - Device type (mobile, desktop)
// - Location (timezone, country)
// - Experience (application)`
  },
  chatbot: {
    title: "LaunchDarkly AI SDK",
    description: "Get AI Config variations dynamically based on context, enabling real-time model switching and A/B testing.",
    language: "typescript",
    code: `// Initialize AI SDK
import { initAi } from "@launchdarkly/server-sdk-ai"

const aiClient = initAi(ldClient)

// Get AI Config variation
const aiConfig = await aiClient.config(
  "ai-config--togglebotchatbot",
  context,
  {},
  { userInput, chatHistory }
)

// Use the selected variation
const model = aiConfig.model
const messages = aiConfig.messages

// Variations enable:
// - Context-based model selection
// - A/B testing different models
// - Monitor and Track AI Metrics`
  },
  banner: {
    title: "Promotional Banner Feature Flag",
    description: "The banner content and visibility are controlled by LaunchDarkly feature flags for dynamic promotions.",
    language: "typescript",
    code: `// Get banner flag from LaunchDarkly
const flags = useFlags()
const storePromoBanner = flags.storePromoBanner as string | undefined

// Map flag variations to banner variants
const getVariant = (flagValue: string | undefined) => {
  if (!flagValue) return null
  const normalized = flagValue.toLowerCase().trim()
  
  if (normalized === "flash sale") return "flash-sale"
  if (normalized === "free shipping") return "free-shipping"
  if (normalized.includes("20 percent")) return "promo-code"
  return null
}

// Render banner based on flag value
const variant = getVariant(storePromoBanner)
if (!variant) return null

// Display appropriate banner variant
{variant === "flash-sale" && <FlashSaleBanner />}
{variant === "free-shipping" && <FreeShippingBanner />}`
  },
  "add-button": {
    title: "LaunchDarkly Metrics",
    description: "Track custom events and metrics with LaunchDarkly to measure feature impact and user behavior.",
    language: "typescript",
    code: `// Track custom events with LaunchDarkly
import { useLDClient } from "launchdarkly-react-client-sdk"

const ldClient = useLDClient()

// Track event with context
ldClient?.track('add_to_cart', context, value)

// Track event without data
ldClient?.track('button_clicked', context)

// Track events enable:
// - Measure feature impact
// - A/B test analysis
// - User behavior tracking
// - Custom analytics`
  },
  "sdk-init": {
    title: "LaunchDarkly SDK Initialization",
    description: "Initialize LaunchDarkly SDK on both client and server to enable feature flag evaluation across your application.",
    language: "typescript",
    code: `// Client-side initialization (React)
import { asyncWithLDProvider } from "launchdarkly-react-client-sdk"
import { Observability } from "@launchdarkly/observability"

const Provider = await asyncWithLDProvider({
  clientSideID: process.env.NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID,
  context: {
    kind: 'multi',
    user: { key: userId, email: userEmail },
    device: { key: deviceType },
    location: { key: timezone }
  },
  options: {
    plugins: [
      new Observability({
        serviceName: "togglestore",
        tracingOrigins: true
      })
    ]
  }
})

// Server-side initialization (Node.js)
import { init } from "@launchdarkly/node-server-sdk"
import { Observability } from "@launchdarkly/observability-node"

const ldClient = await init(process.env.LAUNCHDARKLY_SDK_KEY, {
  plugins: [
    new Observability({
      serviceName: "togglestore",
      serviceVersion: "1.0.0"
    })
  ]
})

await ldClient.waitForInitialization()`
  },
}

export function DeveloperModeOverlay() {
  const { isEnabled, toggle } = useDeveloperMode()
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number; showAbove: boolean; width: number; maxHeight: number } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile - must be before any conditional returns
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Recalculate popup position on window resize
  useEffect(() => {
    if (!isEnabled || !hoveredElement || !popupPosition) return

    const handleResize = () => {
      const highlightable = document.querySelector(`[data-dev-highlight="${hoveredElement}"]`)
      if (!highlightable) return

      const rect = highlightable.getBoundingClientRect()
      const popupWidth = Math.min(400, window.innerWidth - 40)
      const maxPopupHeight = Math.min(600, window.innerHeight - 40)
      const padding = 20
      const offset = 10
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let popupX = rect.right + offset
      let popupY = rect.top
      let showAbove = false

      if (popupX + popupWidth > viewportWidth - padding) {
        popupX = rect.left - popupWidth - offset
        if (popupX < padding) {
          popupX = Math.max(padding, Math.min(viewportWidth - popupWidth - padding, rect.left + rect.width / 2 - popupWidth / 2))
        }
      }

      popupX = Math.max(padding, Math.min(popupX, viewportWidth - popupWidth - padding))

      const spaceBelow = viewportHeight - rect.bottom - padding
      const spaceAbove = rect.top - padding

      // Special handling for chatbot button at bottom right
      const isChatbot = hoveredElement === "chatbot"

      if (isChatbot) {
        // For chatbot, always show above the button
        showAbove = true
        popupY = rect.top
        // Position horizontally to the left of the button since it's at bottom right
        popupX = rect.left - popupWidth - offset
        // If doesn't fit to the left, position above centered
        if (popupX < padding) {
          popupX = Math.max(padding, Math.min(viewportWidth - popupWidth - padding, rect.left + rect.width / 2 - popupWidth / 2))
        }
        // Ensure horizontal bounds
        popupX = Math.max(padding, Math.min(popupX, viewportWidth - popupWidth - padding))
      } else if (spaceBelow >= maxPopupHeight || spaceBelow >= spaceAbove) {
        showAbove = false
        popupY = rect.bottom + offset
        popupY = Math.min(popupY, viewportHeight - maxPopupHeight - padding)
      } else {
        showAbove = true
        popupY = rect.top
        // Only adjust if there's truly not enough space above
        const conservativeHeight = Math.min(maxPopupHeight, 400)
        const estimatedTopAfterTransform = popupY - conservativeHeight
        if (estimatedTopAfterTransform < padding) {
          popupY = Math.max(padding + conservativeHeight, rect.top - 50)
        }
      }

      // Final vertical bounds check for below positioning only
      if (!showAbove) {
        popupY = Math.max(padding, Math.min(popupY, viewportHeight - maxPopupHeight - padding))
      }

      setPopupPosition({ x: popupX, y: popupY, showAbove, width: popupWidth, maxHeight: maxPopupHeight })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isEnabled, hoveredElement, popupPosition])

  useEffect(() => {
    if (!isEnabled) {
      const timeoutId = setTimeout(() => {
        setHoveredElement(null)
        setPopupPosition(null)
      }, 0)
      return () => clearTimeout(timeoutId)
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check if hovering over the popup itself - keep current popup visible
      if (popupRef.current && popupRef.current.contains(target)) {
        return // Keep current popup visible
      }
      
      const highlightable = target.closest("[data-dev-highlight]")
      if (highlightable) {
        const highlightId = highlightable.getAttribute("data-dev-highlight")
        if (highlightId) {
          // Update to show this element's popup (even if it's different from current)
          setHoveredElement(highlightId)
          
          // For buttons and small elements, use the actual hovered element
          // For larger containers, use the container
          const isButton = target.tagName === 'BUTTON' || target.closest('button')
          const elementToPosition = (isButton && target.closest('button')) || highlightable
          const rect = elementToPosition.getBoundingClientRect()
          
          const popupWidth = Math.min(400, window.innerWidth - 40) // Max width with padding
          const maxPopupHeight = Math.min(600, window.innerHeight - 40) // Max height with padding
          const padding = 20
          const offset = 10 // Offset from element
          
          // Calculate available space
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          
          // Try to position to the right of the element first
          let popupX = rect.right + offset
          let popupY = rect.top
          let showAbove = false
          
          // If popup goes off right edge, try to the left
          if (popupX + popupWidth > viewportWidth - padding) {
            popupX = rect.left - popupWidth - offset
            // If still doesn't fit, center horizontally
            if (popupX < padding) {
              popupX = Math.max(padding, Math.min(viewportWidth - popupWidth - padding, rect.left + rect.width / 2 - popupWidth / 2))
            }
          }
          
          // Ensure popup stays within horizontal bounds
          popupX = Math.max(padding, Math.min(popupX, viewportWidth - popupWidth - padding))
          
          // Calculate vertical position - try below first
          const spaceBelow = viewportHeight - rect.bottom - padding
          const spaceAbove = rect.top - padding
          
          // Special handling for chatbot button at bottom right
          const isChatbot = highlightId === "chatbot"
          
          if (isChatbot) {
            // For chatbot, always show above the button
            showAbove = true
            popupY = rect.top
            // Position horizontally to the left of the button since it's at bottom right
            popupX = rect.left - popupWidth - offset
            // If doesn't fit to the left, position above centered
            if (popupX < padding) {
              popupX = Math.max(padding, Math.min(viewportWidth - popupWidth - padding, rect.left + rect.width / 2 - popupWidth / 2))
            }
            // Ensure horizontal bounds
            popupX = Math.max(padding, Math.min(popupX, viewportWidth - popupWidth - padding))
          } else if (spaceBelow >= maxPopupHeight || spaceBelow >= spaceAbove) {
            // Show below
            showAbove = false
            popupY = rect.bottom + offset
            // Ensure it doesn't go off bottom
            popupY = Math.min(popupY, viewportHeight - maxPopupHeight - padding)
          } else {
            // Show above
            showAbove = true
            // Position at the top of the element - transform will move it up
            popupY = rect.top
            // Only adjust if there's truly not enough space above
            // Use a more conservative estimate (actual popup is usually smaller than max)
            const conservativeHeight = Math.min(maxPopupHeight, 400)
            const estimatedTopAfterTransform = popupY - conservativeHeight
            if (estimatedTopAfterTransform < padding) {
              // Not enough space above, but try to stay as close to button as possible
              // Only move up the minimum necessary
              popupY = Math.max(padding + conservativeHeight, rect.top - 50)
            }
          }
          
          // Final vertical bounds check for below positioning only
          if (!showAbove) {
            popupY = Math.max(padding, Math.min(popupY, viewportHeight - maxPopupHeight - padding))
          }
          
          setPopupPosition({ x: popupX, y: popupY, showAbove, width: popupWidth, maxHeight: maxPopupHeight })
        }
      } else {
        // Check if we're hovering over a different highlighted element
        const parentHighlightable = target.closest("[data-dev-highlight]")
        if (parentHighlightable) {
          // Hovering over a different element, update to show its popup
          const highlightId = parentHighlightable.getAttribute("data-dev-highlight")
          if (highlightId && highlightId !== hoveredElement) {
            // Will be handled by the main logic above on next mouse move
            return
          }
        } else if (!popupRef.current?.matches(':hover')) {
          // Not hovering over any highlighted element or popup
          // Only clear after a delay to allow movement to popup
          setTimeout(() => {
            if (!popupRef.current?.matches(':hover')) {
              const anyHighlight = document.querySelector('[data-dev-highlight]:hover')
              if (!anyHighlight) {
                setHoveredElement(null)
                setPopupPosition(null)
              }
            }
          }, 150)
        }
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const relatedTarget = e.relatedTarget as HTMLElement | null
      
      // Check if we're leaving the highlighted element
      const highlightable = target.closest("[data-dev-highlight]")
      if (highlightable) {
        // Check if the related target is still within the highlighted element
        if (relatedTarget && highlightable.contains(relatedTarget)) {
          return // Still inside, don't clear
        }
        // Check if related target is the popup itself - keep it visible
        if (relatedTarget && popupRef.current && popupRef.current.contains(relatedTarget)) {
          return // Mouse moved to popup, keep it visible
        }
        // Check if moving to a different highlighted element
        if (relatedTarget) {
          const newHighlightable = relatedTarget.closest("[data-dev-highlight]")
          if (newHighlightable && newHighlightable !== highlightable) {
            // Moving to a different element, let handleMouseOver handle it
            return
          }
        }
      }
      
      // Only clear if we're truly leaving and not going to popup or another highlighted element
      if (relatedTarget) {
        // Check if moving to popup
        if (popupRef.current && popupRef.current.contains(relatedTarget)) {
          return // Keep popup visible
        }
        // Check if moving to another highlighted element
        if (relatedTarget.closest("[data-dev-highlight]")) {
          return // Let handleMouseOver handle the new element
        }
      }
      
      // Only hide if mouse is truly leaving (with a small delay to allow movement to popup)
      setTimeout(() => {
        // Double-check that we're not hovering over popup or any highlighted element
        if (popupRef.current && popupRef.current.matches(':hover')) {
          return // Still hovering over popup
        }
        const currentHighlight = document.querySelector(`[data-dev-highlight="${hoveredElement}"]`)
        if (currentHighlight && currentHighlight.matches(':hover')) {
          return // Still hovering over highlighted element
        }
        // Check if hovering over any highlighted element
        const anyHighlight = document.querySelector('[data-dev-highlight]:hover')
        if (anyHighlight) {
          return // Hovering over a different highlighted element
        }
        // Finally clear if nothing is being hovered
        setHoveredElement(null)
        setPopupPosition(null)
      }, 150) // Small delay to allow smooth movement to popup
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (hoveredElement) {
        const highlightable = document.querySelector(`[data-dev-highlight="${hoveredElement}"]`)
        if (highlightable) {
          // Check if mouse is over a button within the highlighted element
          const target = e.target as HTMLElement
          const isButton = target.tagName === 'BUTTON' || target.closest('button')
          const elementToPosition = (isButton && target.closest('button')) || highlightable
          const rect = elementToPosition.getBoundingClientRect()
          
          // Calculate optimal popup position that stays within viewport
          const popupWidth = Math.min(400, window.innerWidth - 40)
          const maxPopupHeight = Math.min(600, window.innerHeight - 40)
          const padding = 20
          const offset = 10
          
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          
          // Try to position to the right of the element first
          let popupX = rect.right + offset
          let popupY = rect.top
          let showAbove = false
          
          // If popup goes off right edge, try to the left
          if (popupX + popupWidth > viewportWidth - padding) {
            popupX = rect.left - popupWidth - offset
            if (popupX < padding) {
              popupX = Math.max(padding, Math.min(viewportWidth - popupWidth - padding, rect.left + rect.width / 2 - popupWidth / 2))
            }
          }
          
          // Ensure popup stays within horizontal bounds
          popupX = Math.max(padding, Math.min(popupX, viewportWidth - popupWidth - padding))
          
          // Calculate vertical position
          const spaceBelow = viewportHeight - rect.bottom - padding
          const spaceAbove = rect.top - padding
          
          // Special handling for chatbot button at bottom right
          const isChatbot = hoveredElement === "chatbot"
          
          if (isChatbot) {
            // For chatbot, always show above the button
            showAbove = true
            popupY = rect.top
            // Position horizontally to the left of the button since it's at bottom right
            popupX = rect.left - popupWidth - offset
            // If doesn't fit to the left, position above centered
            if (popupX < padding) {
              popupX = Math.max(padding, Math.min(viewportWidth - popupWidth - padding, rect.left + rect.width / 2 - popupWidth / 2))
            }
            // Ensure horizontal bounds
            popupX = Math.max(padding, Math.min(popupX, viewportWidth - popupWidth - padding))
          } else if (spaceBelow >= maxPopupHeight || spaceBelow >= spaceAbove) {
            showAbove = false
            popupY = rect.bottom + offset
            popupY = Math.min(popupY, viewportHeight - maxPopupHeight - padding)
          } else {
            showAbove = true
            popupY = rect.top
            // Only adjust if there's truly not enough space above
            const conservativeHeight = Math.min(maxPopupHeight, 400)
            const estimatedTopAfterTransform = popupY - conservativeHeight
            if (estimatedTopAfterTransform < padding) {
              popupY = Math.max(padding + conservativeHeight, rect.top - 50)
            }
          }
          
          // Final vertical bounds check for below positioning only
          if (!showAbove) {
            popupY = Math.max(padding, Math.min(popupY, viewportHeight - maxPopupHeight - padding))
          }
          
          setPopupPosition({ x: popupX, y: popupY, showAbove, width: popupWidth, maxHeight: maxPopupHeight })
        }
      }
    }

    document.addEventListener("mouseover", handleMouseOver, true)
    document.addEventListener("mouseout", handleMouseOut, true)
    document.addEventListener("mousemove", handleMouseMove, true)

    return () => {
      document.removeEventListener("mouseover", handleMouseOver, true)
      document.removeEventListener("mouseout", handleMouseOut, true)
      document.removeEventListener("mousemove", handleMouseMove, true)
    }
  }, [isEnabled, hoveredElement])

  // Conditional returns after all hooks
  if (!isEnabled) return null
  if (isMobile) return null

  const codeSample = hoveredElement ? codeSamples[hoveredElement] : null

  return (
    <>
      {/* Persistent toast when developer mode is enabled */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none w-full max-w-[calc(100vw-32px)] sm:max-w-md px-4 hidden md:block">
        <Toast
          variant="success"
          message="Hover over components to see LaunchDarkly code samples"
        />
      </div>

      {/* Disable Developer Mode Button */}
      <div className="fixed bottom-4 left-4 md:left-8 z-[10000] pointer-events-auto hidden md:block">
        <Button
          onClick={toggle}
          variant="default"
          className="rounded-[60px] text-white border-0 px-8 py-8 text-base font-bold developer-tool-button-gradient-flow"
        >
          Turn off Code Samples
        </Button>
      </div>
      {/* Highlighted Elements */}
      <style jsx global>{`
        @keyframes subtle-pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        [data-dev-highlight]:not([style*="position: fixed"]):not(.fixed):not([style*="position: absolute"]):not([data-dev-highlight="sdk-init"]) {
          position: relative;
        }
        /* Don't change position for sdk-init - it's already absolutely positioned */
        [data-dev-highlight="sdk-init"] {
          position: absolute !important;
        }
        [data-dev-highlight]:not([data-dev-highlight="banner"]) {
          z-index: 9999;
        }
        [data-dev-highlight="banner"] {
          z-index: 40 !important;
        }
        [data-dev-highlight][style*="position: fixed"],
        [data-dev-highlight].fixed {
          position: fixed !important;
        }
        
        /* Persistent glow - always visible to indicate interactivity */
        [data-dev-highlight] {
          outline: 1px solid rgba(112, 132, 255, 0.4);
          outline-offset: 2px;
          box-shadow: 
            0 0 10px rgba(112, 132, 255, 0.2),
            0 0 20px rgba(112, 132, 255, 0.15),
            inset 0 0 10px rgba(112, 132, 255, 0.05);
          transition: all 0.3s ease;
        }
        
        /* Special styling for SDK init to prevent image shrinking */
        [data-dev-highlight="sdk-init"] {
          outline: none !important;
          box-shadow: none !important;
          overflow: visible !important;
        }
        
        [data-dev-highlight="sdk-init"]::before {
          content: '';
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          outline: 1px solid rgba(112, 132, 255, 0.4);
          outline-offset: 0;
          border-radius: inherit;
          background: radial-gradient(circle at center, rgba(112, 132, 255, 0.15) 0%, transparent 70%);
          opacity: 0.4;
          animation: subtle-pulse 3s ease-in-out infinite;
          transition: opacity 0.3s ease, outline 0.3s ease;
          pointer-events: none;
          z-index: -1;
          box-shadow: 
            0 0 10px rgba(112, 132, 255, 0.2),
            0 0 20px rgba(112, 132, 255, 0.15);
        }
        
        [data-dev-highlight="sdk-init"]:hover::before {
          opacity: 1;
          animation: none;
          outline: 2px solid #7084FF;
          top: -6px;
          left: -6px;
          right: -6px;
          bottom: -6px;
          background: radial-gradient(circle at center, rgba(112, 132, 255, 0.3) 0%, transparent 70%);
          box-shadow: 
            0 0 20px rgba(112, 132, 255, 0.6),
            0 0 40px rgba(112, 132, 255, 0.4),
            0 0 60px rgba(112, 132, 255, 0.3);
        }
        
        /* Enhanced glow on hover */
        [data-dev-highlight]:hover {
          outline: 2px solid #7084FF;
          outline-offset: 4px;
          box-shadow: 
            0 0 20px rgba(112, 132, 255, 0.6),
            0 0 40px rgba(112, 132, 255, 0.4),
            0 0 60px rgba(112, 132, 255, 0.3),
            inset 0 0 20px rgba(112, 132, 255, 0.15);
        }
        
        /* Persistent background glow */
        [data-dev-highlight]:not([data-dev-highlight="sdk-init"])::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: inherit;
          background: radial-gradient(circle at center, rgba(112, 132, 255, 0.15) 0%, transparent 70%);
          opacity: 0.4;
          animation: subtle-pulse 3s ease-in-out infinite;
          transition: opacity 0.3s ease;
          pointer-events: none;
          z-index: -1;
        }
        
        /* Enhanced background glow on hover */
        [data-dev-highlight]:not([data-dev-highlight="sdk-init"]):hover::before {
          opacity: 1;
          animation: none;
          background: radial-gradient(circle at center, rgba(112, 132, 255, 0.3) 0%, transparent 70%);
        }
        
        /* Custom scrollbar for code popup */
        .code-popup-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .code-popup-scroll::-webkit-scrollbar-track {
          background: #0a0a0a;
          border-radius: 4px;
        }
        .code-popup-scroll::-webkit-scrollbar-thumb {
          background: #7084FF;
          border-radius: 4px;
        }
        .code-popup-scroll::-webkit-scrollbar-thumb:hover {
          background: #405BFF;
        }
      `}</style>

      {/* Code Sample Popup */}
      {hoveredElement && codeSample && popupPosition && (
        <div
          ref={popupRef}
          className="fixed z-[10000] bg-[#191919] border-2 border-[#7084FF] rounded-[15px] p-6 shadow-2xl pointer-events-auto flex flex-col"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            width: `${popupPosition.width}px`,
            maxWidth: '90vw',
            maxHeight: `${popupPosition.maxHeight}px`,
            transform: popupPosition.showAbove ? "translateY(-100%)" : "translateY(0)",
          }}
          onMouseEnter={() => {
            // Keep popup visible when hovering over it
          }}
          onMouseLeave={(e) => {
            // Only hide if mouse is not moving to highlighted element or another highlighted element
            const relatedTarget = e.relatedTarget as HTMLElement | null
            
            // Check if moving to the original highlighted element
            const highlightable = document.querySelector(`[data-dev-highlight="${hoveredElement}"]`)
            if (relatedTarget && highlightable && highlightable.contains(relatedTarget)) {
              return // Moving back to original element, keep popup
            }
            
            // Check if moving to a different highlighted element
            if (relatedTarget) {
              const newHighlightable = relatedTarget.closest("[data-dev-highlight]")
              if (newHighlightable) {
                // Moving to a different element, let handleMouseOver handle it
                return
              }
            }
            
            // Small delay to allow moving back to element or another element
            setTimeout(() => {
              // Check if hovering over popup
              if (popupRef.current?.matches(':hover')) {
                return // Still hovering over popup
              }
              
              // Check if hovering over original highlighted element
              if (highlightable?.matches(':hover')) {
                return // Still hovering over original element
              }
              
              // Check if hovering over any highlighted element
              const anyHighlight = document.querySelector('[data-dev-highlight]:hover')
              if (anyHighlight) {
                return // Hovering over a different highlighted element
              }
              
              // Finally hide if not hovering over anything relevant
              setHoveredElement(null)
              setPopupPosition(null)
            }, 200) // Longer delay to allow smooth movement
          }}
        >
          <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
            <div className="flex-shrink-0">
              <h3 className="text-white text-lg font-bold mb-1">{codeSample.title}</h3>
              <p className="text-[#A7A9AC] text-sm leading-relaxed">{codeSample.description}</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-[10px] p-4 border border-[#58595B] flex-1 min-h-0 overflow-auto code-popup-scroll" style={{ scrollbarWidth: 'thin', scrollbarColor: '#7084FF #0a0a0a' }}>
              <pre className="text-[12px] text-[#7084FF] font-mono leading-relaxed whitespace-pre-wrap">
                <code>{codeSample.code}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

