import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Sign up for an OpenBots autonomous agent workspace.",
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
