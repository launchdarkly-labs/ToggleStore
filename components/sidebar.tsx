"use client"

import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { X, QrCode } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { useDeveloperMode } from "@/lib/developer-mode-context"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

interface MenuItem {
  id: string
  title: string
  icon: string
  href?: string
}

const menuItems: MenuItem[] = [
  {
    id: "code-examples",
    title: "Code examples",
    icon: "/assets/icons/data_object.svg",
    href: "/code-examples",
  },
  {
    id: "architecture",
    title: "Architecture",
    icon: "/assets/icons/stacks.svg",
  },
  {
    id: "resources",
    title: "Resources",
    icon: "/assets/icons/developer_guide.svg",
  },
]

function DeveloperToolToggle({ onClose }: { onClose: () => void }) {
  const { isEnabled, toggle } = useDeveloperMode()

  const handleToggle = () => {
    const wasDisabled = !isEnabled
    toggle()
    // Close sidebar if enabling the toggle
    if (wasDisabled) {
      onClose()
    }
  }

  return (
    <div className="relative h-[75px] rounded-[20px] overflow-hidden group" style={{ background: "var(--Grayscale-Black-01, #282828)" }}>
      {/* Glow effect background */}
      <div className="absolute left-[22.5px] top-[-214.43px] w-[calc(648.425px*0.792)] h-[calc(648.425px*0.611)] opacity-30 pointer-events-none">
        <div className="absolute inset-[-15.42%_-28.23%] opacity-20">
          <div 
            className="w-full h-full blur-3xl" 
            style={{
              background: "linear-gradient(to bottom right, #405BFF, #7084FF)"
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-between px-6 sm:px-[26px] z-10">
        <p className="text-white text-base font-bold leading-[1.3]">
          Code Samples
        </p>
        {/* iOS-style Toggle Switch */}
        <button
          onClick={handleToggle}
          className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${
            isEnabled ? "bg-[#7084FF]" : "bg-[#58595B]"
          }`}
          role="switch"
          aria-checked={isEnabled}
          aria-label="Toggle Developer Tool"
        >
          <span
            className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white transition-transform duration-200 ${
              isEnabled ? "translate-x-[20px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [showQRCode, setShowQRCode] = useState(false)
  const [currentUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.origin + window.location.pathname
    }
    return ""
  })

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="left"
        hideCloseButton
        className="w-full max-w-full sm:max-w-[375px] sm:w-[375px] bg-[#191919] border-r border-[#58595B] flex flex-col p-0 overflow-hidden"
      >
        {/* Header with Logo and Close Button */}
        <SheetHeader className="relative pt-[60px] px-6 sm:px-[49px] shrink-0">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={onClose} className="flex items-center">
              <div className="h-[28.406px] w-auto relative">
                <Image
                  src="/assets/icons/launchdarkly-logo.png"
                  alt="LaunchDarkly"
                  width={188}
                  height={28.406}
                  className="h-[28.406px] w-auto object-contain"
                />
              </div>
            </Link>
            <button
              onClick={onClose}
              className="w-6 h-6 sm:w-[24px] sm:h-[24px] flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <X size={24} className="text-[#7084FF]" />
            </button>
          </div>
        </SheetHeader>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-[26.5px] pt-6 sm:pt-[36px] pb-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* App Section */}
          <div className="flex flex-col gap-5 mb-8">
            <div className="flex flex-col gap-3">
              <p className="text-[#939598] text-[12px] font-bold tracking-[1.8px] uppercase">
                APP
              </p>
            </div>

            {/* ToggleStore Card */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
            >
              <Link
                href="/"
                onClick={onClose}
                className="relative h-[75px] rounded-[20px] overflow-hidden group block"
                style={{
                  background: "var(--Grayscale-Black-01, #282828)",
                }}
              >
                {/* Glow effect background */}
                <div className="absolute left-[22.5px] top-[-214.43px] w-[calc(648.425px*0.792)] h-[calc(648.425px*0.611)] opacity-30 pointer-events-none">
                  <div className="absolute inset-[-15.42%_-28.23%] opacity-20">
                    <div 
                      className="w-full h-full blur-3xl" 
                      style={{
                        background: "linear-gradient(to bottom right, #405BFF, #7084FF)"
                      }}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-[26px] z-10">
                  <div className="flex items-center justify-center relative">
                    {/* Toggle text */}
                    <span 
                      className="text-base sm:text-lg font-bold leading-[1.2] tracking-[0.32px] shrink-0 mr-[-8px] sm:mr-[-10px] relative z-10"
                      style={{
                        fontFamily: "var(--font-sohne), sans-serif",
                        WebkitTextFillColor: "transparent",
                        backgroundImage:
                          "linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 100%), linear-gradient(215.4deg, #fff 32.1%, #f7f8ff 34.4%, #7084ff 118.1%)",
                        backgroundClip: "text",
                      }}
                    >
                      Toggle
                    </span>
                    
                    {/* Icon - positioned to overlap both words */}
                    <div className="relative w-[50px] sm:w-[60px] h-[50px] sm:h-[60px] flex items-center justify-center shrink-0 z-20">
                      <Image
                        src="/storefront/ToggleHomePage.png"
                        alt="Toggle Mascot"
                        width={60}
                        height={60}
                        className="w-full h-full object-contain"
                        priority
                      />
                    </div>
                    
                    {/* Store text */}
                    <span 
                      className="text-base sm:text-lg font-bold leading-[1.2] tracking-[0.48px] shrink-0 ml-[-8px] sm:ml-[-10px] relative z-10"
                      style={{
                        fontFamily: "var(--font-sohne), sans-serif",
                        WebkitTextFillColor: "transparent",
                        backgroundImage:
                          "linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 100%), linear-gradient(-28.2deg, #7084ff 18.3%, #f7f8ff 76.9%, #fff 152.47%)",
                        backgroundClip: "text",
                      }}
                    >
                      Store
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>

          {/* Explore More Section */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p className="text-[#939598] text-[12px] font-bold tracking-[1.8px] uppercase">
                EXPLORE MORE
              </p>
            </div>

            {/* Menu Cards */}
            <div className="flex flex-col gap-2">
              {menuItems.map((item) => {
                const content = (
                  <>
                    {/* Glow effect background */}
                    <div className="absolute left-[22.5px] top-[-214.43px] w-[calc(648.425px*0.792)] h-[calc(648.425px*0.611)] opacity-30 pointer-events-none">
                      <div className="absolute inset-[-15.42%_-28.23%] opacity-20">
                        <div 
                          className="w-full h-full blur-3xl" 
                          style={{
                            background: "linear-gradient(to bottom right, #405BFF, #7084FF)"
                          }}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="absolute inset-0 flex items-center justify-between px-6 sm:px-[26px] z-10">
                      <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="w-6 h-6 sm:w-[24px] sm:h-[24px] relative shrink-0">
                          <Image
                            src={item.icon}
                            alt={item.title}
                            width={24}
                            height={24}
                            className="w-full h-full object-contain brightness-0 invert"
                          />
                        </div>
                        <p className="text-white text-base font-bold leading-[1.3] truncate">
                          {item.title}
                        </p>
                      </div>
                      <div className="w-[17px] h-[21px] relative shrink-0">
                        <Image
                          src="/assets/icons/carrot_forward.svg"
                          alt="Arrow"
                          width={17}
                          height={21}
                          className="w-full h-full object-contain brightness-0 invert"
                        />
                      </div>
                    </div>
                  </>
                )

                if (item.href) {
                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.05 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="relative h-[75px] rounded-[20px] overflow-hidden group block"
                        style={{
                          background: "var(--Grayscale-Black-01, #282828)",
                        }}
                      >
                        {content}
                      </Link>
                    </motion.div>
                  )
                }

                return (
                  <motion.button
                    key={item.id}
                    className="relative h-[75px] rounded-[20px] overflow-hidden group"
                    style={{
                      background: "var(--Grayscale-Black-01, #282828)",
                    }}
                    whileHover={{ scale: 1.05 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }}
                  >
                    {content}
                  </motion.button>
                )
              })}
            </div>

            

          {/* Tools Section - Hidden on mobile */}
          <div className="hidden md:block mt-8 pt-8 border-t border-[#58595B]/30 w-full">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <p className="text-[#939598] text-[12px] font-bold tracking-[1.8px] uppercase">
                  TOOLS
                </p>
              </div>

              {/* Developer Tool Toggle */}
              <DeveloperToolToggle onClose={onClose} />
            </div>
          </div>

          {/* Learn More Section */}
          <div className="mt-8 pt-8 border-t border-[#58595B]/30 w-full">
            <div className="flex flex-col items-center gap-6 md:gap-[42px] w-full">
              <div className="flex flex-col items-center gap-2 text-center w-full">
                <p
                  className="text-[12px] tracking-[1.8px] uppercase font-bold bg-clip-text"
                  style={{ WebkitTextFillColor: "white" }}
                >
                  Learn More about LaunchDarkly
                </p>
              </div>

              <div className="flex flex-col gap-4 md:gap-6 w-full">
                <Button
                  variant="default"
                  className="rounded-[60px] px-6 md:px-[37.8px] py-[29px] whitespace-nowrap text-xl md:text-xl z-10 text-white category-button-selected w-full"
                  onClick={() => window.open("https://launchdarkly.com/request-a-demo/", "_blank")}
                >
                  Book Meeting
                </Button>
                <Button
                  variant="outline"
                  className="rounded-[60px] px-6 md:px-[37.8px] py-[29px] text-xl md:text-xl whitespace-nowrap border-[#7084ff] text-[#7084FF] bg-[#191919] hover:border-[#7084FF] hover:bg-transparent hover:text-[#B3BDFF] w-full"
                  onClick={() => window.open("https://launchdarkly.com/", "_blank")}
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>

          {/* QR Code Section - Only shown on mobile (where header QR code is hidden) */}
          <div className="md:hidden mt-8 pt-8 border-t border-[#58595B]/30 w-full">
            <div className="flex flex-col items-center gap-4">
              <p className="text-[#A7A9AC] text-sm text-center">
                Scan to open on your mobile device
              </p>
              <button
                onClick={() => {
                  onClose() // Close the sidebar first
                  setShowQRCode(true) // Then show the QR code
                }}
                className="relative h-[75px] rounded-[20px] overflow-hidden group w-full"
                style={{
                  background: "var(--Grayscale-Black-01, #282828)",
                }}
              >
                {/* Glow effect background */}
                <div className="absolute left-[22.5px] top-[-214.43px] w-[calc(648.425px*0.792)] h-[calc(648.425px*0.611)] opacity-30 pointer-events-none">
                  <div className="absolute inset-[-15.42%_-28.23%] opacity-20">
                    <div 
                      className="w-full h-full blur-3xl" 
                      style={{
                        background: "linear-gradient(to bottom right, #405BFF, #7084FF)"
                      }}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex items-center justify-center gap-4 px-6 z-10">
                  <QrCode size={24} className="text-[#7084FF]" />
                  <p className="text-white text-base font-bold leading-[1.3]">
                    Show QR Code
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
        </div>
      </SheetContent>

      {/* QR Code Overlay - Full Screen (same as header) */}
      {showQRCode && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Close if clicking on the overlay background (not on content)
            if (e.target === e.currentTarget) {
              setShowQRCode(false)
            }
          }}
        >
          {/* Close button - top right */}
          <button
            onClick={() => setShowQRCode(false)}
            className="absolute top-4 right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-[1.125px] border-[#7084FF] bg-[#7084FF]/10 flex items-center justify-center hover:bg-[#7084FF]/20 transition-colors z-10"
            aria-label="Close QR Code"
          >
            <X size={20} className="text-[#7084FF]" />
          </button>
          
          {/* QR Code Content */}
          <div className="flex flex-col items-center gap-8 sm:gap-10 w-full max-w-4xl px-4">
            <p className="text-white text-xl sm:text-2xl md:text-3xl font-bold text-center">
              Scan to open on your mobile device
            </p>
            <div className="bg-white p-8 sm:p-12 md:p-16 rounded-[30px] flex items-center justify-center shadow-2xl">
              <QRCodeSVG
                value={currentUrl}
                size={500}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-[#A7A9AC] text-base sm:text-lg md:text-xl text-center break-all max-w-full px-4">
              {currentUrl}
            </p>
          </div>
        </div>
      )}
    </Sheet>
  )
}

