"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"
import { Play, CheckCircle2, XCircle, Loader2, BarChart3, RefreshCw } from "lucide-react"

interface GeneratorConfig {
  searchAlgorithmUsers: number
  storePromoUsers: number
  aiConfigUsers: number
  aiMonitoringRuns: number
  shoppingAssistantUsers: number
  numErrors: number
}

interface GenerationResult {
  success: boolean
  message: string
  results?: {
    searchAlgorithm?: { users: number; status: string }
    storePromo?: { users: number; status: string }
    aiConfig?: { users: number; status: string }
    aiMonitoring?: { runs: number; status: string }
    shoppingAssistant?: { users: number; status: string }
    errors?: { count: number; status: string }
  }
  error?: string
}

const defaultConfig: GeneratorConfig = {
  searchAlgorithmUsers: 3000,
  storePromoUsers: 3000,
  aiConfigUsers: 3000,
  aiMonitoringRuns: 1000,
  shoppingAssistantUsers: 1000,
  numErrors: 50,
}

export default function ResultsGeneratorPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [config, setConfig] = useState<GeneratorConfig>(defaultConfig)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [progress, setProgress] = useState<string>("")

  const handleSidebarOpen = () => setSidebarOpen(true)
  const handleSidebarClose = () => setSidebarOpen(false)

  const handleInputChange = (field: keyof GeneratorConfig, value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 0) {
      setConfig((prev) => ({ ...prev, [field]: numValue }))
    } else if (value === "") {
      setConfig((prev) => ({ ...prev, [field]: 0 }))
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setResult(null)
    setProgress("Starting results generation...")

    try {
      setProgress("Generating experiment results and metrics...")
      
      const response = await fetch("/api/generate-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      })

      const data = await response.json()
      
      setProgress("Processing complete!")
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to generate results",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    setConfig(defaultConfig)
    setResult(null)
    setProgress("")
  }

  const totalOperations = 
    config.searchAlgorithmUsers + 
    config.storePromoUsers + 
    config.aiConfigUsers + 
    config.aiMonitoringRuns + 
    config.shoppingAssistantUsers + 
    config.numErrors

  return (
    <div className="min-h-screen bg-[#191919] relative">
      {/* Header */}
      <Header onSidebarOpen={handleSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />

      {/* Main Content */}
      <main className="pt-[150px] pb-20 px-4 sm:px-8 lg:px-[182.75px] max-w-[1440px] mx-auto">
        {/* Page Title */}
        <div className="mb-12 sm:mb-[80px]">
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
            Results Generator
          </h1>
          <p className="mt-4 text-[#A7A9AC] text-lg max-w-2xl">
            Generate experiment metrics, AI monitoring data, and error logs for LaunchDarkly analytics dashboards.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Configuration Panel */}
          <div className="relative rounded-[30px] overflow-hidden border border-[#58595B] bg-[#282828] p-6 sm:p-8">
            {/* Subtle glow effect */}
            <div className="absolute left-0 top-0 w-full h-32 opacity-20 pointer-events-none">
              <div 
                className="w-full h-full blur-3xl" 
                style={{
                  background: "linear-gradient(to bottom, #405BFF, transparent)"
                }}
              />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-[#7084FF]/20 flex items-center justify-center">
                  <BarChart3 size={20} className="text-[#7084FF]" />
                </div>
                <h2 className="text-white text-xl sm:text-2xl font-bold">Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Experiment Results Section */}
                <div className="space-y-4">
                  <p className="text-[#939598] text-xs font-bold tracking-[1.8px] uppercase">
                    Experiment Results
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="searchAlgorithm" className="text-[#A7A9AC] text-sm">
                        Search Algorithm Users
                      </Label>
                      <Input
                        id="searchAlgorithm"
                        type="number"
                        min="0"
                        value={config.searchAlgorithmUsers}
                        onChange={(e) => handleInputChange("searchAlgorithmUsers", e.target.value)}
                        className="bg-[#191919] border-[#58595B] text-white placeholder:text-[#58595B] focus:border-[#7084FF] focus:ring-[#7084FF]/20 h-12 rounded-xl"
                        disabled={isGenerating}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="storePromo" className="text-[#A7A9AC] text-sm">
                        Store Promo Banner Users
                      </Label>
                      <Input
                        id="storePromo"
                        type="number"
                        min="0"
                        value={config.storePromoUsers}
                        onChange={(e) => handleInputChange("storePromoUsers", e.target.value)}
                        className="bg-[#191919] border-[#58595B] text-white placeholder:text-[#58595B] focus:border-[#7084FF] focus:ring-[#7084FF]/20 h-12 rounded-xl"
                        disabled={isGenerating}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="aiConfig" className="text-[#A7A9AC] text-sm">
                        AI Config Users
                      </Label>
                      <Input
                        id="aiConfig"
                        type="number"
                        min="0"
                        value={config.aiConfigUsers}
                        onChange={(e) => handleInputChange("aiConfigUsers", e.target.value)}
                        className="bg-[#191919] border-[#58595B] text-white placeholder:text-[#58595B] focus:border-[#7084FF] focus:ring-[#7084FF]/20 h-12 rounded-xl"
                        disabled={isGenerating}
                      />
                    </div>
                  </div>
                </div>

                {/* AI Monitoring Section */}
                <div className="space-y-4 pt-4 border-t border-[#58595B]/30">
                  <p className="text-[#939598] text-xs font-bold tracking-[1.8px] uppercase">
                    AI Monitoring
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="aiMonitoring" className="text-[#A7A9AC] text-sm">
                        AI Monitoring Runs
                      </Label>
                      <Input
                        id="aiMonitoring"
                        type="number"
                        min="0"
                        value={config.aiMonitoringRuns}
                        onChange={(e) => handleInputChange("aiMonitoringRuns", e.target.value)}
                        className="bg-[#191919] border-[#58595B] text-white placeholder:text-[#58595B] focus:border-[#7084FF] focus:ring-[#7084FF]/20 h-12 rounded-xl"
                        disabled={isGenerating}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shoppingAssistant" className="text-[#A7A9AC] text-sm">
                        Shopping Assistant Users
                      </Label>
                      <Input
                        id="shoppingAssistant"
                        type="number"
                        min="0"
                        value={config.shoppingAssistantUsers}
                        onChange={(e) => handleInputChange("shoppingAssistantUsers", e.target.value)}
                        className="bg-[#191919] border-[#58595B] text-white placeholder:text-[#58595B] focus:border-[#7084FF] focus:ring-[#7084FF]/20 h-12 rounded-xl"
                        disabled={isGenerating}
                      />
                    </div>
                  </div>
                </div>

                {/* Observability Section */}
                <div className="space-y-4 pt-4 border-t border-[#58595B]/30">
                  <p className="text-[#939598] text-xs font-bold tracking-[1.8px] uppercase">
                    Observability
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="numErrors" className="text-[#A7A9AC] text-sm">
                      Number of Errors to Generate
                    </Label>
                    <Input
                      id="numErrors"
                      type="number"
                      min="0"
                      value={config.numErrors}
                      onChange={(e) => handleInputChange("numErrors", e.target.value)}
                      className="bg-[#191919] border-[#58595B] text-white placeholder:text-[#58595B] focus:border-[#7084FF] focus:ring-[#7084FF]/20 h-12 rounded-xl"
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                {/* Total Operations Info */}
                <div className="pt-4 border-t border-[#58595B]/30">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#A7A9AC]">Total Operations:</span>
                    <span className="text-white font-bold">{totalOperations.toLocaleString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || totalOperations === 0}
                    className="flex-1 rounded-[60px] px-6 py-6 text-lg font-bold text-white bg-[#7084FF] hover:bg-[#5a6ee0] disabled:bg-[#58595B] disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play size={20} />
                        Generate Results
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleReset}
                    disabled={isGenerating}
                    variant="outline"
                    className="rounded-[60px] px-6 py-6 text-lg font-bold border-[#58595B] text-[#A7A9AC] hover:border-[#7084FF] hover:text-white bg-transparent disabled:opacity-50"
                  >
                    <RefreshCw size={20} />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="relative rounded-[30px] overflow-hidden border border-[#58595B] bg-[#282828] p-6 sm:p-8 min-h-[400px]">
            {/* Subtle glow effect */}
            <div className="absolute right-0 top-0 w-full h-32 opacity-20 pointer-events-none">
              <div 
                className="w-full h-full blur-3xl" 
                style={{
                  background: "linear-gradient(to bottom, #405BFF, transparent)"
                }}
              />
            </div>

            <div className="relative z-10 h-full">
              <h2 className="text-white text-xl sm:text-2xl font-bold mb-8">Status</h2>

              <AnimatePresence mode="wait">
                {!isGenerating && !result && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center justify-center h-[300px] text-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-[#58595B]/30 flex items-center justify-center mb-6">
                      <BarChart3 size={40} className="text-[#58595B]" />
                    </div>
                    <p className="text-[#A7A9AC] text-lg">
                      Configure your settings and click &quot;Generate Results&quot; to start.
                    </p>
                  </motion.div>
                )}

                {isGenerating && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center justify-center h-[300px] text-center"
                  >
                    <div className="relative w-24 h-24 mb-6">
                      {/* Outer ring */}
                      <div className="absolute inset-0 rounded-full border-4 border-[#58595B]/30" />
                      {/* Animated ring */}
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-[#7084FF] border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      {/* Inner icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BarChart3 size={32} className="text-[#7084FF]" />
                      </div>
                    </div>
                    <p className="text-white text-lg font-bold mb-2">Generating Results</p>
                    <p className="text-[#A7A9AC] text-sm">{progress}</p>
                    <p className="text-[#58595B] text-xs mt-4">
                      This may take a few minutes for large datasets...
                    </p>
                  </motion.div>
                )}

                {result && !isGenerating && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {/* Overall Status */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl ${
                      result.success ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
                    }`}>
                      {result.success ? (
                        <CheckCircle2 size={32} className="text-green-500 shrink-0" />
                      ) : (
                        <XCircle size={32} className="text-red-500 shrink-0" />
                      )}
                      <div>
                        <p className={`font-bold ${result.success ? "text-green-500" : "text-red-500"}`}>
                          {result.success ? "Generation Complete" : "Generation Failed"}
                        </p>
                        <p className="text-[#A7A9AC] text-sm">{result.message}</p>
                      </div>
                    </div>

                    {/* Detailed Results */}
                    {result.results && (
                      <div className="space-y-3">
                        <p className="text-[#939598] text-xs font-bold tracking-[1.8px] uppercase">
                          Detailed Results
                        </p>
                        
                        <div className="space-y-2">
                          {result.results.searchAlgorithm && (
                            <ResultItem
                              label="Search Algorithm"
                              value={`${result.results.searchAlgorithm.users.toLocaleString()} users`}
                              status={result.results.searchAlgorithm.status}
                            />
                          )}
                          {result.results.storePromo && (
                            <ResultItem
                              label="Store Promo Banner"
                              value={`${result.results.storePromo.users.toLocaleString()} users`}
                              status={result.results.storePromo.status}
                            />
                          )}
                          {result.results.aiConfig && (
                            <ResultItem
                              label="AI Config"
                              value={`${result.results.aiConfig.users.toLocaleString()} users`}
                              status={result.results.aiConfig.status}
                            />
                          )}
                          {result.results.aiMonitoring && (
                            <ResultItem
                              label="AI Monitoring"
                              value={`${result.results.aiMonitoring.runs.toLocaleString()} runs`}
                              status={result.results.aiMonitoring.status}
                            />
                          )}
                          {result.results.shoppingAssistant && (
                            <ResultItem
                              label="Shopping Assistant"
                              value={`${result.results.shoppingAssistant.users.toLocaleString()} users`}
                              status={result.results.shoppingAssistant.status}
                            />
                          )}
                          {result.results.errors && (
                            <ResultItem
                              label="Error Logs"
                              value={`${result.results.errors.count.toLocaleString()} errors`}
                              status={result.results.errors.status}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {result.error && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                        <p className="text-red-400 text-sm font-mono break-all">{result.error}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function ResultItem({ label, value, status }: { label: string; value: string; status: string }) {
  const isCompleted = status === "completed"
  
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#191919] border border-[#58595B]/30">
      <div className="flex items-center gap-3">
        {isCompleted ? (
          <CheckCircle2 size={16} className="text-green-500" />
        ) : (
          <XCircle size={16} className="text-red-500" />
        )}
        <span className="text-white text-sm">{label}</span>
      </div>
      <span className="text-[#A7A9AC] text-sm">{value}</span>
    </div>
  )
}

