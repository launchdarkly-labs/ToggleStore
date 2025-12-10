import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { LaunchDarklyProvider } from "@/lib/launchdarkly/client"
import { LoginProvider } from "@/lib/login-context"
import { ToastProvider } from "@/lib/toast"
import { DeveloperModeProvider } from "@/lib/developer-mode-context"
import "./globals.css"

// Sohne font family
const sohne = localFont({
  src: [
    {
      path: "../public/fonts/sohne-light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/sohne.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/sohne.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sohne",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
})

// Sohne Mono for prices and monospace text
const sohneMono = localFont({
  src: [
    {
      path: "../public/fonts/sohne-mono.otf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-sohne-mono",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
})

export const metadata: Metadata = {
  title: "ToggleStore - LaunchDarkly Demo",
  description: "E-commerce demo application showcasing LaunchDarkly feature flags",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ToggleStore",
  },
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  viewportFit: "cover",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${sohne.variable} ${sohneMono.variable}`}>
      <body className="font-sans antialiased min-h-dvh">
        <LaunchDarklyProvider>
          <LoginProvider>
            <DeveloperModeProvider>
              <ToastProvider>{children}</ToastProvider>
            </DeveloperModeProvider>
          </LoginProvider>
        </LaunchDarklyProvider>
      </body>
    </html>
  )
}
