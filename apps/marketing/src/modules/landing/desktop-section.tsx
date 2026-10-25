import Image from "next/image"
import { LaptopCode, ShieldCheck, Eye } from "reicon-react"

export default function DesktopSection() {
  return (
    <section className="border-t bg-muted/20 px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
              A real computer for every AI coworker
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              No brittle headless scrapers. OpenBots provisions each agent with
              its own sandboxed Linux desktop running on Daytona. Watch tools
              work in real-time over noVNC with automatic wake/sleep lifecycle
              management.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <LaptopCode className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Full Virtual Display & Browser
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Agents click, type, scroll, take screenshots, and download
                    files inside a live graphical desktop.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Human-in-the-Loop Takeover (HITL)
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Agent hit a 2FA or Captcha challenge? Take direct mouse
                    control in noVNC, complete it, and click done.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <Eye className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Zero-Leak Isolated Sandboxes
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sandboxes are isolated per agent and auto-pruned upon agent
                    deletion, preserving zero stale resources.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full bg-red-400/80" />
                <span className="size-2.5 rounded-full bg-amber-400/80" />
                <span className="size-2.5 rounded-full bg-green-400/80" />
                <span className="ml-2 font-mono text-[11px]">
                  daytona-sandbox // novnc:6080
                </span>
              </div>
              <div className="overflow-hidden">
                <Image
                  src="/preview-vm.png"
                  alt="Cloud desktop live preview with noVNC"
                  width={1400}
                  height={880}
                  className="h-auto w-full scale-[1.025] object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
