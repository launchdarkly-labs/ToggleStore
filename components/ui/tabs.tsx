"use client"

import * as React from "react"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider")
  }
  return context
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className = "" }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function TabsList({ children, className = "", style }: TabsListProps) {
  return (
    <div
      className={`flex border-b border-[#58595B] ${className}`}
      role="tablist"
      style={style}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function TabsTrigger({ value, children, className = "", style }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext()
  const isSelected = selectedValue === value

  // If custom style is provided or className indicates custom styling, skip defaults
  // This ensures production builds don't apply conflicting default styles
  const hasCustomStyling = style || 
    className.includes("border") || 
    className.includes("bg-") ||
    className.includes("text-[") ||
    className.length > 50 // Likely has custom classes

  const defaultClasses = hasCustomStyling
    ? ""
    : `px-4 py-2 text-sm font-medium transition-colors relative ${
        isSelected
          ? "text-[#ebff38] border-b-2 border-[#ebff38] -mb-[1px]"
          : "text-[#A7A9AC] hover:text-white"
      }`

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={`${defaultClasses} ${className}`}
      style={style}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className = "" }: TabsContentProps) {
  const { value: selectedValue } = useTabsContext()

  if (selectedValue !== value) {
    return null
  }

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  )
}

