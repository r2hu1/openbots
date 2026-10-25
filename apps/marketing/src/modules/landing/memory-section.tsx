import Image from "next/image"
import { GemSparkle, CheckListNotes, Search } from "reicon-react"

export default function MemorySection() {
  return (
    <section className="border-t bg-muted/20 px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Coworkers that remember your habits and guidelines
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              No need to repeat prompt context on every message. OpenBots equips
              agents with autonomous long-term memory tools. Search, recall, and
              inspect saved memories anytime.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <GemSparkle className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Automatic Memory Retention
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Agents store project constraints, credentials preferences,
                    and user preferences with zero friction.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <CheckListNotes className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    In-Chat Agent Memory Sheet
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Open the Memory Sheet directly from the conversation header
                    to audit, search, and delete individual memories.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                  <Search className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">
                    Semantic Search & Multi-Day Recall
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Equipped with search_memory and get_chat_history to
                    seamlessly resume complex tasks across days.
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
                  agent-memory-sheet // scoped
                </span>
              </div>
              <div className="overflow-hidden">
                <Image
                  src="/preview-memory.png"
                  alt="Agent memory management sheet"
                  width={1400}
                  height={880}
                  className="h-auto w-full scale-[1.025] object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
