import Image from "next/image"
import { Check } from "reicon-react"

const ARTIFACT_TYPES = [
  {
    title: "Interactive Web Sandbox",
    desc: "Executes living HTML, CSS, JavaScript, and Tailwind markup directly inside a secure isolated frame.",
  },
  {
    title: "Multi-Page PDF Viewer",
    desc: "Built with pdfjs-dist canvas fallback featuring interactive zoom, fit-width, and direct PDF printing.",
  },
  {
    title: "Word & Spreadsheets",
    desc: "Native in-app document parsing for Microsoft Word (.docx) and spreadsheets (.xlsx, .csv).",
  },
  {
    title: "Mermaid & Vector SVGs",
    desc: "Auto-renders architecture diagrams, entity charts, and crisp scalable vector illustrations.",
  },
]

export default function ArtifactsSection() {
  return (
    <section className="border-t px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="order-2 lg:order-1 lg:col-span-7">
            <div className="flex flex-col gap-6">
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-red-400/80" />
                  <span className="size-2.5 rounded-full bg-amber-400/80" />
                  <span className="size-2.5 rounded-full bg-green-400/80" />
                  <span className="ml-2 font-mono text-[11px]">
                    inline-preview.svg
                  </span>
                </div>
                <div className="overflow-hidden">
                  <Image
                    src="/preview-artifacts-inline.png"
                    alt="Inline artifact preview"
                    width={1200}
                    height={800}
                    className="h-auto w-full scale-[1.025] object-contain"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-red-400/80" />
                  <span className="size-2.5 rounded-full bg-amber-400/80" />
                  <span className="size-2.5 rounded-full bg-green-400/80" />
                  <span className="ml-2 font-mono text-[11px]">
                    artifact-drawer.tsx
                  </span>
                </div>
                <div className="overflow-hidden">
                  <Image
                    src="/preview-artifacts.png"
                    alt="Expanded full artifact preview"
                    width={1200}
                    height={800}
                    className="h-auto w-full scale-[1.025] object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5">
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Living code and rich documents, not walls of markdown
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              When OpenBots drafts an interactive dashboard, slide deck, or
              business report, it renders directly in the timeline with
              expandable side sheets and one-click exports.
            </p>

            <div className="mt-8 space-y-4">
              {ARTIFACT_TYPES.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-foreground">
                    <Check className="size-3.5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
