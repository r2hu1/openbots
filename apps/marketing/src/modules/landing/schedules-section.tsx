import Image from "next/image"
import { CalendarCheck, Bell, Clock } from "reicon-react"

export default function SchedulesSection() {
  return (
    <section className="border-t px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="order-2 lg:order-1 lg:col-span-7">
            <div className="overflow-hidden rounded-lg border bg-background">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full bg-red-400/80" />
                <span className="size-2.5 rounded-full bg-amber-400/80" />
                <span className="size-2.5 rounded-full bg-green-400/80" />
                <span className="ml-2 font-mono text-[11px]">
                  trigger.dev // durable-cron
                </span>
              </div>
              <div className="overflow-hidden">
                <Image
                  src="/preview-schedules.png"
                  alt="Background schedules and triggers"
                  width={1400}
                  height={880}
                  className="h-auto w-full scale-[1.025] object-contain"
                />
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5">
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Agents that work while you sleep
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              OpenBots isn't limited to prompt-and-response. Schedule durable
              background jobs with human-language timers, cron rules, and
              proactive notifications.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <CalendarCheck className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Recurring & Delayed Tasks
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    "Check GitHub PRs every weekday morning" or "Summarize news
                    at 6pm"—runs automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <Bell className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Native Web Push Notifications
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Receive push alerts on desktop and mobile as soon as the
                    background workflow delivers results.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <Clock className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Survives Server Restarts
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Powered by Trigger.dev v4, scheduled executions never drop
                    when instances restart or scale down.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
