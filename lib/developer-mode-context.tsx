"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface DeveloperModeContextType {
  isEnabled: boolean
  toggle: () => void
  setEnabled: (enabled: boolean) => void
}

const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined)

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false)

  const toggle = () => setIsEnabled((prev) => !prev)
  const setEnabled = (enabled: boolean) => setIsEnabled(enabled)

  return (
    <DeveloperModeContext.Provider value={{ isEnabled, toggle, setEnabled }}>
      {children}
    </DeveloperModeContext.Provider>
  )
}

export function useDeveloperMode() {
  const context = useContext(DeveloperModeContext)
  if (context === undefined) {
    throw new Error("useDeveloperMode must be used within a DeveloperModeProvider")
  }
  return context
}

