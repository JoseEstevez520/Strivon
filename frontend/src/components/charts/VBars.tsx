import { Link } from 'react-router'

export interface VBarItem {
  key: string
  label: string
  /** 0 to 1. */
  value: number
  /** Where the column leads, if anywhere. */
  to?: string
}

/** Columns side by side to compare a few things on one scale, the value on top of each. */
export function VBars({ items }: { items: VBarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 0.01)
  return (
    <ul className="flex items-stretch gap-3" style={{ height: '11rem' }}>
      {items.map((i) => {
        const body = (
          <>
            <span className="text-center text-meta tabular-nums text-fg-secondary">{Math.round(i.value * 100)}%</span>
            <span className="block w-full rounded-md bg-[color-mix(in_oklab,var(--fg)_30%,transparent)]" style={{ height: `${(i.value / max) * 62}%` }} />
            <span className="line-clamp-2 h-8 text-center text-meta leading-4 text-fg-secondary" title={i.label}>
              {i.label}
            </span>
          </>
        )
        const cls = 'flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5'
        return (
          <li key={i.key} className="flex min-w-0 flex-1">
            {i.to ? (
              <Link to={i.to} className={`${cls} w-full rounded-md transition-colors hover:bg-surface`}>
                {body}
              </Link>
            ) : (
              <span className={cls}>{body}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
