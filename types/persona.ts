export interface Persona {
  personaname: string
  personatier: "Standard" | "Platinum" | "Gold" | "Silver"
  personaimage: string
  personaemail: string
  personarole: "User" | "Developer" | "Beta" | "Admin"
  personalaunchclubstatus?: string
  personaEnrolledInLaunchClub?: boolean
}

