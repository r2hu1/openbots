import Link from "next/link"
import { Button } from "@openbots/ui/components/button"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { ArrowUpRight } from "reicon-react"

export default function CtaSection() {
  return (
    <section className="border-t bg-muted/20 px-6 py-20 text-center sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto flex w-fit items-center gap-2">
          <Blobatar
            name="OpenBots"
            className="size-12 sm:size-16"
            blobatar={{
              animate: "always",
              traits: {
                shape: 0.11,
                "body.r": 0.463,
                "body.rot": 0.908,
                "poly.round": 0.8,
              },
            }}
          />
        </div>

        <h2 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
          Build your autonomous AI workforce today
        </h2>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          100% open-source, self-hostable, and equipped with full desktop sandboxes.
          Deploy in minutes on your own infrastructure.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            render={<Link href="https://github.com/r2hu1/openbots" />}
            nativeButton={false}
            className="h-10 px-5 text-sm"
          >
            Star on GitHub <ArrowUpRight />
          </Button>

          <Button
            render={<Link href="https://github.com/r2hu1/openbots/blob/main/SELF_HOST.md" />}
            nativeButton={false}
            variant="outline"
            className="h-10 px-5 text-sm"
          >
            Self-Hosting Guide
          </Button>
        </div>
      </div>
    </section>
  )
}
