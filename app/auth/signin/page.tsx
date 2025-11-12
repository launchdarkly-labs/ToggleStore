import { signIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#191919]">
      <Card className="w-[400px] bg-[#212121] border-[#58595b]">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Welcome to ToggleStore</CardTitle>
          <CardDescription className="text-[#A7A9AC]">
            Sign in with your LaunchDarkly account to access admin features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/" })
            }}
          >
            <Button type="submit" className="w-full bg-[#7084FF] hover:bg-[#405BFF]">
              Sign in with Google
            </Button>
          </form>
          <p className="text-xs text-[#58595B] mt-4 text-center">
            Only @launchdarkly.com emails are allowed
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

