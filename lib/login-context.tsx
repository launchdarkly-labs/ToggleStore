"use client"

import { useLDClient } from "launchdarkly-react-client-sdk"
import { createContext, useState, useContext, ReactNode, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import CryptoJS from "crypto-js"
import { isAndroid, isIOS, isBrowser, isMobile, isMacOs, isWindows } from "react-device-detect"
import { setCookie, getCookie } from "cookies-next"
import { LD_CONTEXT_COOKIE_KEY } from "@/lib/constants"
import { STARTER_PERSONAS } from "@/lib/personas"
import { Persona } from "@/types/persona"
import { useLaunchDarklyStatus } from "@/lib/launchdarkly/client"

const operatingSystem = isAndroid
  ? "Android"
  : isIOS
    ? "iOS"
    : isWindows
      ? "Windows"
      : isMacOs
        ? "macOS"
        : ""
const device = isMobile ? "Mobile" : isBrowser ? "Desktop" : ""

const startingUserObject: Persona = {
  personaname: "",
  personatier: "Standard",
  personaimage: "",
  personaemail: "",
  personarole: "User",
  personalaunchclubstatus: "",
  personaEnrolledInLaunchClub: false,
}

export interface LoginContextType {
  userObject: Persona
  isLoggedIn: boolean
  loginUser: (email: string) => Promise<void>
  logoutUser: () => Promise<void>
  updateUserContext: () => Promise<void>
  allUsers: Persona[]
  appMultiContext: Record<string, unknown> | null
}

const LoginContext = createContext<LoginContextType>({
  userObject: startingUserObject,
  isLoggedIn: false,
  async loginUser() {},
  async logoutUser() {},
  async updateUserContext() {},
  allUsers: [],
  appMultiContext: {} as Record<string, unknown>,
})

export const useLoginContext = () => useContext(LoginContext)

export const LoginProvider = ({ children }: { children: ReactNode }) => {
  const client = useLDClient()
  const { isInitialized } = useLaunchDarklyStatus()
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [userObject, setUserObject] = useState<Persona>(startingUserObject)
  const [allUsers, setAllUsers] = useState<Persona[]>(STARTER_PERSONAS)
  const [appMultiContext, setAppMultiContext] = useState<Record<string, unknown> | null>(null)

  // Initialize context on mount - either from cookie or create anonymous
  useEffect(() => {
    const initializeContext = async () => {
      if (isInitialized && client) {
        const cookieContext = getCookie(LD_CONTEXT_COOKIE_KEY)
        try {
          const parsed = JSON.parse(cookieContext as string)
          setAppMultiContext(parsed)
          // Check if user is logged in (not anonymous)
          if (parsed?.user && !parsed.user.anonymous && parsed.user.email) {
            const foundPersona = STARTER_PERSONAS.find(
              (p) => p.personaemail === parsed.user.email
            )
            if (foundPersona) {
              setUserObject(foundPersona)
              setIsLoggedIn(true)
            }
          }
        } catch (error) {
          console.warn("Failed to parse LD context from cookie:", error)
        } 
      }
    }

    initializeContext()
  }, [isInitialized, client])

  const hashEmail = async (email: string): Promise<string> => {
    return CryptoJS.SHA256(email).toString()
  }

  const getLocation = async (): Promise<{
    key: string
    name: string
    timeZone: string
    country: string
  }> => {
    const options = Intl.DateTimeFormat().resolvedOptions()
    const country = options.locale.split("-")[1] || "US"
    return {
      key: options.timeZone,
      name: options.timeZone,
      timeZone: options.timeZone,
      country: country,
    }
  }

  const loginUser = async (email: string): Promise<void> => {
    if (!client || !isInitialized) {
      console.error("LaunchDarkly client not available or not initialized")
      return
    }
   
    // Update all personas array with changes if user was previously logged in
    if (Object.keys(userObject).length > 0 && userObject.personaemail) {
      setAllUsers((prevObj) => [
        ...prevObj.filter((persona) => persona?.personaemail !== userObject?.personaemail),
        userObject,
      ])
    }

    const foundPersona: Persona | undefined = allUsers?.find((persona) =>
      persona?.personaemail?.includes(email)
    )

    if (!foundPersona) {
      console.error("Persona not found for email:", email)
      return
    }

    await setUserObject(foundPersona)

    // Get location for context
    const location = await getLocation()
    const hashedEmail = await hashEmail(email)

    // Build new multi-context with persona data
    const context: Record<string, unknown> = {
      kind: "multi",
      user: {
        name: foundPersona?.personaname,
        email: foundPersona?.personaemail,
        anonymous: false,
        key: hashedEmail,
        role: foundPersona?.personarole,
        tier: foundPersona?.personatier,
        device: device,
        operating_system: operatingSystem,
        location: location,
      },
      device: {
        key: device || "unknown",
        name: device || "Unknown Device",
        operating_system: operatingSystem,
        platform: device,
      },
      location: {
        key: location.key,
        name: location.name,
        timeZone: location.timeZone,
        country: location.country,
      },
      experience: {
        key: "togglestore",
        name: "ToggleStore",
        application: "togglestore",
      }
    }
    
    setAppMultiContext(context)
    await client.identify(context)
    console.log("loginUser", context)

    setCookie(LD_CONTEXT_COOKIE_KEY, JSON.stringify(context), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
    setIsLoggedIn(true)
  
  }

  const updateUserContext = async (): Promise<void> => {
    if (!client || !isInitialized) {
      console.error("LaunchDarkly client not available or not initialized")
      return
    }

    const currentContext = client.getContext() as Record<string, unknown>
    const location = await getLocation()
    const newDevice = Math.random() < 0.5 ? "Mobile" : "Desktop"
    const osOptions = newDevice === "Mobile" ? ["iOS", "Android"] : ["macOS", "Windows"]
    const newOS = osOptions[Math.floor(Math.random() * osOptions.length)]
    const newTier = ["Gold", "Silver", "Platinum", "Standard"][Math.floor(Math.random() * 4)]

    // Build new context with updated user data
    const currentUser = (currentContext.user as Record<string, unknown>) || {}
    const context: Record<string, unknown> = {
      ...currentContext,
      user: {
        ...currentUser,
        key: uuidv4(),
        device: newDevice,
        operating_system: newOS,
        location: location,
        tier: newTier,
        anonymous: false,
      },
    }

    setAppMultiContext(context)
    setCookie(LD_CONTEXT_COOKIE_KEY, JSON.stringify(context), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
    console.log("updateUserContext", context)
    await client.identify(context)
  }

  const logoutUser = async (): Promise<void> => {
    if (!client || !isInitialized) {
      console.error("LaunchDarkly client not available or not initialized")
      return
    }

    // Reset user state first
    setIsLoggedIn(false)
    setUserObject(startingUserObject)
    setAllUsers(STARTER_PERSONAS)

    // Get location for context
    const location = await getLocation()

    // Create anonymous user context matching the structure from client.tsx
    const anonymousUserContext = {
      kind: 'user',
      anonymous: true,
      key: uuidv4(),
    }

    // Build anonymous multi-context matching the structure from client.tsx
    const context = {
      kind: "multi",
      user: anonymousUserContext,
      device: {
        key: device || "unknown",
        name: device || "Unknown Device",
        operating_system: operatingSystem,
        platform: device,
      },
      location: {
        key: location.key,
        name: location.name,
        timeZone: location.timeZone,
        country: location.country,
      },
      experience: {
        key: "togglestore",
        name: "ToggleStore",
        application: "togglestore",
      }
    }

    // Update state and cookie
    setAppMultiContext(context)
    setCookie(LD_CONTEXT_COOKIE_KEY, JSON.stringify(context), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    // Identify with LaunchDarkly to reset context
    await client.identify(context)
    console.log("[LoginContext] ✅ Logged out - Anonymous context set:", context)
  }

  return (
    <LoginContext.Provider
      value={{
        userObject,
        isLoggedIn,
        updateUserContext,
        loginUser,
        logoutUser,
        allUsers,
        appMultiContext,
      }}
    >
      {children}
    </LoginContext.Provider>
  )
}

