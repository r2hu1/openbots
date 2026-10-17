import type { Token } from "./sheet-common"

export function SheetCodeEditor({ lines }: { lines: Token[][] }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-sidebar py-4 font-mono text-[13px] leading-6 [scrollbar-width:thin]">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((tokens, i) => (
            <tr key={i} className="align-top">
              <td className="w-14 min-w-14 pr-4 text-right text-muted-foreground/50 select-none">
                {i + 1}
              </td>
              <td className="pr-6 [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">
                {tokens.length === 0
                  ? " "
                  : tokens.map((token, j) => (
                      <span key={j} className={token.cls}>
                        {token.text}
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
