"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error for monitoring
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#191919] p-4">
      <Card className="w-full max-w-[500px] bg-[#212121] border-[#58595b]">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Something went wrong!</CardTitle>
          <CardDescription className="text-[#A7A9AC]">
            An unexpected error occurred. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={reset}
            className="w-full bg-[#7084FF] hover:bg-[#405BFF]"
          >
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            className="w-full border-[#58595b] text-white hover:bg-[#212121]"
          >
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

