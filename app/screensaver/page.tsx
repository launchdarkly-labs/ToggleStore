"use client"

import { useEffect, useRef, useState } from "react"
import { X, Maximize2, Minimize2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function ScreensaverPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error)
      })
      // Hide controls after 3 seconds
      const timeout = setTimeout(() => {
        setShowControls(false)
      }, 3000)
      controlsTimeoutRef.current = timeout
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    // Hide controls after 3 seconds of no movement
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }

  const handleFullscreen = async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error)
    }
  }

  const handleBack = () => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
    router.back()
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onMouseMove={handleMouseMove}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src="/launchdarkly/screensaver.mp4"
        loop
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 flex items-end justify-center pb-8 gap-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <Button
          onClick={handleFullscreen}
          variant="outline"
          size="lg"
          className="rounded-[60px] px-6 py-6 border-[#7084FF] text-[#7084FF] bg-black/50 hover:bg-black/70 backdrop-blur-sm"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 size={24} className="mr-2" />
          ) : (
            <Maximize2 size={24} className="mr-2" />
          )}
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </Button>
        <Button
          onClick={handleBack}
          variant="outline"
          size="lg"
          className="rounded-[60px] px-6 py-6 border-[#7084FF] text-[#7084FF] bg-black/50 hover:bg-black/70 backdrop-blur-sm"
          aria-label="Back to app"
        >
          <ArrowLeft size={24} className="mr-2" />
          Back to App
        </Button>
      </div>

      {/* Always visible close button in top right corner */}
      <button
        onClick={handleBack}
        className={`absolute top-4 right-4 w-12 h-12 rounded-full border-[1.125px] border-[#7084FF] bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 z-10 ${
          showControls ? "opacity-100" : "opacity-30 hover:opacity-100"
        }`}
        aria-label="Back to app"
      >
        <X size={20} className="text-[#7084FF]" />
      </button>
    </div>
  )
}

