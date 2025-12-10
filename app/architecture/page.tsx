"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import Image from "next/image"

export default function ArchitecturePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSidebarOpen = () => {
    setSidebarOpen(true)
  }

  const handleSidebarClose = () => {
    setSidebarOpen(false)
  }

  // Architecture images in order
  const architectureImages = [
    "/launchdarkly/ld-arch-1.svg",
    "/launchdarkly/ld-arch-2.svg",
    "/launchdarkly/ld-arch-3.svg",
    "/launchdarkly/ld-arch-4.svg",
    "/launchdarkly/ld-arch-5.svg",
    "/launchdarkly/ld-arch-6.svg",
    "/launchdarkly/ld-arch-7.svg",
    "/launchdarkly/ld-arch-8.svg",
    "/launchdarkly/ld-arch-9.svg",
    "/launchdarkly/ld-arch-10.svg",
  ]

  return (
    <div className="min-h-screen bg-[#191919] relative">
      {/* Header */}
      <Header onSidebarOpen={handleSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />

      {/* Main Content */}
      <main className="pt-[150px] pb-20 px-4 sm:px-8 lg:px-[182.75px] max-w-[1440px] mx-auto">
        {/* Page Title */}
        <div className="mb-[80px]">
          <h1
            className="text-[40px] sm:text-[50px] lg:text-[70px] leading-[1.2] font-bold"
            style={{
              fontFamily: "var(--font-sohne), sans-serif",
              WebkitTextFillColor: "transparent",
              backgroundImage:
                "linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.1) 100%), linear-gradient(188.29deg, rgba(255, 255, 255, 1) 20.65%, rgba(247, 248, 255, 1) 47.15%, rgba(112, 132, 255, 1) 132.52%)",
              backgroundClip: "text",
            }}
          >
            Architecture
          </h1>
        </div>

        {/* Architecture Images Grid */}
        <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 w-full">
          {architectureImages.map((imagePath, index) => (
            <div
              key={index}
              className="relative w-full rounded-[30px] overflow-hidden border border-[#58595B] bg-[#282828] p-4 sm:p-6 lg:p-8 hover:border-[#7084FF]/50 transition-colors duration-300"
            >
              <div className="relative w-full">
                <Image
                  src={imagePath}
                  alt={`Architecture diagram ${index + 1}`}
                  width={1200}
                  height={800}
                  className="w-full h-auto object-contain rounded-[20px]"
                  priority={index < 2}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

