"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessages: Record<string, string> = {
    AccessDenied: "Access denied. Only @launchdarkly.com emails are allowed to sign in.",
    Configuration: "There is a problem with the server configuration.",
    Verification: "The verification token has expired or has already been used.",
    Default: "An error occurred during authentication. Please try again.",
  }

  const errorMessage = errorMessages[error || ""] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#191919]">
      <Card className="w-[400px] bg-[#212121] border-[#58595b]">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Authentication Error</CardTitle>
          <CardDescription className="text-[#A7A9AC]">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/auth/signin">
            <Button className="w-full bg-[#7084FF] hover:bg-[#405BFF]">
              Back to Sign In
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full border-[#58595b] text-white hover:bg-[#212121]">
              Go to Storefront
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

