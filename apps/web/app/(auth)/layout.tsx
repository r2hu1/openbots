import { authClient } from "@/lib/auth-client"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  })
  console.log(data)
  if (data.data?.session) return redirect("/")
  return children
}
