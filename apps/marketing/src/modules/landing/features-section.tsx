import Image from "next/image"
import {
  LaptopCode,
  CalendarCheck,
  CodeFile,
  Devices,
  GemSparkle,
  MessageDots,
} from "reicon-react"

const FEATURE_CARDS = [
  {
    title: "Isolated Cloud Desktop & Browser Automation",
    description:
      "Every agent runs in a dedicated Daytona cloud sandbox with real-time noVNC streaming, full computer use, and Human-in-the-Loop browser takeover.",
    image: "/preview-vm.png",
    alt: "Cloud VM desktop preview",
    icon: LaptopCode,
    highlights: [
      "Sandboxed execution",
      "noVNC live stream",
      "HITL human takeover",
    ],
  },
  {
    title: "Living Artifacts & Document Generation",
    description:
      "Go beyond raw markdown text. OpenBots renders responsive HTML/CSS prototypes, interactive PDF/DOCX viewers, spreadsheets, and Mermaid diagrams.",
    image: "/preview-artifacts.png",
    alt: "Interactive artifacts preview",
    icon: CodeFile,
    highlights: [
      "Interactive HTML sandbox",
      "PDF canvas viewer",
      "Mermaid charts",
    ],
  },
  {
    title: "Persistent Agent Memory & Recall",
    description:
      "Give coworkers a persistent brain that retains context, user habits, and project guidelines across threads with scoped search and retrieval tools.",
    image: "/preview-memory.png",
    alt: "Persistent memory sheet",
    icon: GemSparkle,
    highlights: [
      "Cross-session memory",
      "Agent memory sheet",
      "Semantic retrieval",
    ],
  },
  {
    title: "Background Schedules & Web Push",
    description:
      "Trigger-powered cron schedules run autonomously in the background, surviving server restarts and dispatching native Web Push alerts.",
    image: "/preview-schedules.png",
    alt: "Durable schedules preview",
    icon: CalendarCheck,
    highlights: [
      "Trigger.dev workflows",
      "Server restart survival",
      "Native push alerts",
    ],
  },
  {
    title: "Human-Readable Streaming Workspace",
    description:
      "Collaborate in a distraction-free environment with high-level activity streams, multi-image uploads, optimistic messaging, and celebratory reactions.",
    image: "/preview-chat.png",
    alt: "Conversational chat workspace",
    icon: MessageDots,
    highlights: [
      "Human activity stream",
      "Multi-image vision",
      "Emoji reactions",
    ],
  },
  {
    title: "200+ SaaS Integrations & Model Flexibility",
    description:
      "Plug into Composio, GitHub, Slack, Notion, and custom MCP tools. Switch between Gemini, Claude, OpenAI, and OpenRouter per agent.",
    image: "/preview-connections.png",
    alt: "SaaS integrations preview",
    icon: Devices,
    highlights: [
      "Composio & MCP protocols",
      "Multi-model intelligence",
      "Custom tool registry",
    ],
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
            Everything your AI team needs to work
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            From isolated cloud computers to multi-agent memory and background
            schedules—OpenBots gives models real hands and tools.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.title}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-6 transition hover:border-foreground/30"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-xl font-medium tracking-tight">
                      {card.title}
                    </h3>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {card.highlights.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-md border bg-muted/20">
                  <Image
                    src={card.image}
                    alt={card.alt}
                    width={1200}
                    height={800}
                    className="h-auto w-full scale-[1.025] object-contain transition duration-500 group-hover:scale-[1.04]"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
