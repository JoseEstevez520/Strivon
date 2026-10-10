export interface StackPart {
  key: string
  label: string
  share: number
  /** A CSS colour. */
  color: string
}

/** One bar split into parts that add up to the whole, with what each part is underneath. */
export function StackBar({ parts }: { parts: StackPart[] }) {
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.share * 100)}%`).join(', ')}>
        {parts.map((p) => (
          <span key={p.key} className="block h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${p.share * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-meta text-fg-secondary">
            <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            {p.label}
            <span className="tabular-nums text-fg">{Math.round(p.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
