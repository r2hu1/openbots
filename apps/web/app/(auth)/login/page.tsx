"use client"

import { Button } from "@openbots/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openbots/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@openbots/ui/components/field"
import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { IconRobot } from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { signIn } from "@/lib/auth-client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await signIn.email({
        email,
        password,
      })

      if (res.error) {
        setError(
          res.error.message || "Failed to sign in. Please verify credentials."
        )
        return
      }

      router.push("/")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center">
            <Blobatar
              className="size-14!"
              blobatar={{ animate: "always" }}
              name="openbots"
            />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Sign in to OpenBots
          </CardTitle>
          <CardDescription>
            Enter your email and password to access your agents
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Spinner data-icon="inline-start" />}
              Sign In
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-primary hover:underline"
              >
                Create an account
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
  )
}
