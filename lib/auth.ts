import NextAuth, { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig: NextAuthConfig = {
  trustHost: true, // Trust the host for development (localhost)
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow LaunchDarkly domain emails to sign in
      if (user.email && user.email.endsWith("@launchdarkly.com")) {
        return true
      }
      // Deny sign in for non-LaunchDarkly emails
      return false
    },
    async session({ session, token }) {
      // Add user info to session
      if (session.user) {
        session.user.id = token.sub as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

