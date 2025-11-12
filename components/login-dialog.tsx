"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { useLoginContext } from "@/lib/login-context"
import { useToast } from "@/lib/toast"
import { STARTER_PERSONAS } from "@/lib/personas"
import { Persona } from "@/types/persona"
import { motion } from "framer-motion"

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { loginUser, userObject, isLoggedIn, logoutUser } = useLoginContext()
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (persona: Persona) => {
    setIsLoading(true)
    try {
      // If already logged in, logout first
      if (isLoggedIn) {
        await logoutUser()
      }
      await loginUser(persona.personaemail)
      showToast("success", `Logged in as ${persona.personaname}`)
      onOpenChange(false)
    } catch (error) {
      console.error("Error logging in:", error)
      showToast("error", "Failed to log in. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const isSelectedPersona = (persona: Persona) => {
    return isLoggedIn && userObject.personaemail === persona.personaemail
  }

  const PersonaCard = ({ persona, isSelected, isLoading, onLogin }: {
    persona: Persona
    isSelected: boolean
    isLoading: boolean
    onLogin: () => void
  }) => {
    const [isHovered, setIsHovered] = useState(false)
    
    return (
      <button
        onClick={onLogin}
        disabled={isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          flex gap-4 md:gap-5 items-start p-5 md:p-[30px] rounded-[15px] transition-all text-left w-full min-w-0 relative overflow-hidden group
          ${
            isSelected
              ? "bg-[rgba(33,33,33,0.5)] border border-[#7084FF]"
              : "border border-[#2c2c2c] hover:border-[#58595b]"
          }
          ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        {/* Avatar */}
        <motion.div 
          className="relative shrink-0 w-[48px] h-[48px] md:w-[54px] md:h-[54px] rounded-full overflow-hidden"
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Image
            src={persona.personaimage}
            alt={persona.personaname}
            width={54}
            height={54}
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[60px] md:h-[65px]">
          <div className="flex flex-col gap-[8px] md:gap-[10px]">
            <motion.h3
              className={`
                text-[20px] md:text-[24px] font-bold leading-[1.4] line-clamp-1
                ${
                  isSelected
                    ? "text-white"
                    : "bg-clip-text text-transparent bg-linear-to-b from-white to-transparent"
                }
              `}
              style={
                !isSelected
                  ? {
                      WebkitTextFillColor: "transparent",
                      backgroundImage:
                        "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    }
                  : undefined
              }
              animate={{ scale: isHovered ? 1.05 : 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {persona.personaname}
            </motion.h3>
            <p
              className={`
                text-[11px] md:text-[12px] leading-normal truncate
                ${isSelected ? "text-[#BCBEC0]" : "text-[#58595B]"}
              `}
            >
              {persona.personaemail}
            </p>
          </div>
          <p
            className={`
              text-[11px] md:text-[12px] leading-normal whitespace-nowrap
              ${isSelected ? "text-[#7084FF]" : "text-[#A7A9AC]"}
            `}
          >
            <span>{persona.personarole}</span>
            <span className={`${isSelected ? "text-[#BCBEC0]" : "text-[#58595B]"} mx-1 md:mx-2`}>
              |
            </span>
            <span>{persona.personatier}</span>
          </p>
        </div>
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-full sm:max-w-[98vw] md:max-w-[95vw] lg:max-w-[96vw] xl:max-w-[1400px] w-full sm:w-auto h-screen sm:h-auto border-0 sm:border border-[#58595b] rounded-0 sm:rounded-[30px] p-0 bg-[#191919] max-h-screen sm:max-h-[90vh] overflow-y-hidden overflow-x-hidden top-0! left-0! translate-x-0! translate-y-0! sm:top-[50%]! sm:left-[50%]! sm:-translate-x-1/2! sm:-translate-y-1/2! flex flex-col"
        style={{
          backgroundImage:
            "linear-gradient(179.99999992093447deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
        }}
        showCloseButton={false}
      >
        {/* Accessible title for screen readers */}
        <VisuallyHidden>
          <DialogTitle>Switch SSO User</DialogTitle>
        </VisuallyHidden>

        {/* Header with Icon, Title and Close Button */}
        <div className="flex items-center gap-6 px-4 sm:px-6 md:px-8 pt-6 sm:pt-10 pb-5 shrink-0">
            <Image
              src="/storefront/Icon-Person.svg"
              alt=""
              width={36}
              height={36}
              className="w-12 h-12"
            />
          <h2 className="text-white text-[28px] sm:text-[32px] font-bold leading-[1.3] flex-1">
            Switch SSO User
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="w-[54px] h-[54px] rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors shrink-0"
          >
            <Image src="/assets/icons/close.svg" alt="Close" width={31.5} height={31.5} className="w-[31.5px] h-[31.5px]" />
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-4 sm:px-6 md:px-8 pb-2 shrink-0">
          <p className="text-[#A7A9AC] text-[16px] leading-normal">
            Select a persona to log in.
          </p>
        </div>

        {/* Personas Grid */}
        <div className="px-4 sm:px-6 md:px-8 pb-8 sm:pb-10 overflow-y-hidden overflow-x-hidden flex-1 min-h-0">
          <div 
            className="overflow-y-auto overflow-x-hidden max-h-[calc(90vh-200px)] sm:max-h-[calc(90vh-250px)] hide-scrollbar" 
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 w-full min-w-0 pb-2">
              {STARTER_PERSONAS.map((persona) => {
                const isSelected = isSelectedPersona(persona)
                return (
                  <PersonaCard
                    key={persona.personaemail}
                    persona={persona}
                    isSelected={isSelected}
                    isLoading={isLoading}
                    onLogin={() => handleLogin(persona)}
                  />
                )
              })}
            </div>
          </div>

          {/* Logout Button */}
          {isLoggedIn && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={async () => {
                  setIsLoading(true)
                  try {
                    await logoutUser()
                    onOpenChange(false)
                  } catch (error) {
                    console.error("Error logging out:", error)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                disabled={isLoading}
                className="px-8 py-3 rounded-[60px] border border-[#7084FF] text-[#7084FF] hover:bg-[#7084FF]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

