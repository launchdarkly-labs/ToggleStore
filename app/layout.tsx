import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { LaunchDarklyProvider } from "@/lib/launchdarkly/client"
import { LoginProvider } from "@/lib/login-context"
import { ToastProvider } from "@/lib/toast"
import { DeveloperModeProvider } from "@/lib/developer-mode-context"
import { auth } from "@/lib/auth"
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
  },
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
  const session = await auth()
  const user = session?.user
    ? {
        key: session.user.id || session.user.email || "anonymous",
        email: session.user.email || undefined,
        name: session.user.name || undefined,
      }
    : undefined

  return (
    <html lang="en" className={`dark ${sohne.variable} ${sohneMono.variable}`}>
      <body className="font-sans antialiased min-h-dvh">
        <LaunchDarklyProvider user={user}>
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
