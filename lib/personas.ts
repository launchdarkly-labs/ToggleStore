import { Persona } from "@/types/persona"

export const PERSONA_TIER_STANDARD = "Standard"
export const PERSONA_TIER_PLATINUM = "Platinum"
export const PERSONA_TIER_GOLD = "Gold"
export const PERSONA_TIER_SILVER = "Silver"

export const PERSONA_ROLE_USER = "User"
export const PERSONA_ROLE_DEVELOPER = "Developer"
export const PERSONA_ROLE_BETA = "Beta"
export const PERSONA_ROLE_ADMIN = "Admin"

export const STARTER_PERSONAS: Persona[] = [
  {
    personaname: "Christine",
    personatier: PERSONA_TIER_STANDARD,
    personaimage: "/assets/personas/persona1.png",
    personaemail: "user@togglestore.app",
    personarole: PERSONA_ROLE_USER,
  },
  {
    personaname: "Angela",
    personatier: PERSONA_TIER_PLATINUM,
    personaimage: "/assets/personas/persona2.png",
    personaemail: "angela@togglestore.app",
    personarole: PERSONA_ROLE_USER,
  },
  {
    personaname: "Alysha",
    personatier: PERSONA_TIER_STANDARD,
    personaimage: "/assets/personas/persona3.png",
    personaemail: "alysha@togglestore.app",
    personarole: PERSONA_ROLE_BETA,
  },
  {
    personaname: "Jenn",
    personatier: PERSONA_TIER_STANDARD,
    personaimage: "/assets/personas/persona4.png",
    personaemail: "jenn@togglestore.app",
    personarole: PERSONA_ROLE_DEVELOPER,
  },
  {
    personaname: "Cody",
    personatier: PERSONA_TIER_STANDARD,
    personaimage: "/assets/personas/persona5.png",
    personaemail: "cody@togglestore.app",
    personarole: PERSONA_ROLE_USER,
  },
]
