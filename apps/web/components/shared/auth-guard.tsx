"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { useSession } from "@/lib/auth-client"
import { Spinner } from "@openbots/ui/components/spinner"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login")
    }
  }, [session, isPending, router])

  if (isPending) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
