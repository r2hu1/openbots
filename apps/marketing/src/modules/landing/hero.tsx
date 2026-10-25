import { Button } from "@openbots/ui/components/button"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import Link from "next/link"
import { ArrowUpRight } from "reicon-react"

export default function Hero() {
  return (
    <section className="px-6 py-10 text-center sm:px-0 sm:py-20">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto flex w-fit items-center gap-2">
          <h1 className="text-3xl font-medium md:text-4xl lg:text-5xl">Meet</h1>
          <Blobatar
            name="OpenBots"
            className="size-12 sm:size-20"
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
          <h1 className="text-3xl font-medium md:text-4xl lg:text-5xl">
            OpenBots
          </h1>
        </div>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          AI coworkers built to get things done. They access your apps, operate
          your tools like a human teammate, and deliver finished results.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            render={<Link href="https://r2hu1.is-a.dev" />}
            nativeButton={false}
            className="h-9 px-4 text-sm sm:h-10"
            variant="secondary"
          >
            Contact Me
          </Button>
          <Button
            className="h-9 px-4 text-sm sm:h-10"
            render={<Link href="https://github.com/r2hu1/openbots" />}
            nativeButton={false}
          >
            Get Started <ArrowUpRight />
          </Button>
        </div>
      </div>
      <video
        src="https://github.com/user-attachments/assets/98400eca-4bea-44be-8d6d-b6c478e92def"
        controls
        className="mx-auto mt-15 w-full max-w-5xl rounded-lg border"
        playsInline
        poster="/preview-chat.png"
      >
        Your browser does not support video playback.
      </video>
    </section>
  )
}
