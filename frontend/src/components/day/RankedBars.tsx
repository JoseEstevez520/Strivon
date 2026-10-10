import { Link } from 'react-router'

export interface RankedItem {
  key: string
  label: string
  /** The share of the time, 0 to 1. */
  share: number
  /** Where the row leads, if anywhere. */
  to?: string
}

/**
 * A ranking with the bar inside the row, the label on the left and the value on the right. The bar
 * is neutral: the number says how much, and colour is kept for what a state means.
 */
export function RankedBars({ items }: { items: RankedItem[] }) {
  const max = Math.max(...items.map((i) => i.share), 0.001)

  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const row = (
          <>
            <span className="min-w-0 truncate text-ui">{item.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden>
              <span
                className="block h-full rounded-full bg-[color-mix(in_oklab,var(--fg)_30%,transparent)]"
                style={{ width: `${(item.share / max) * 100}%` }}
              />
            </span>
            <span className="text-right text-meta tabular-nums text-fg-secondary">{Math.round(item.share * 100)}%</span>
          </>
        )
        const cls = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_3.5rem] items-center gap-3 rounded-md px-2 py-2'
        return (
          <li key={item.key}>
            {item.to ? (
              <Link to={item.to} className={`${cls} transition-colors hover:bg-surface`}>
                {row}
              </Link>
            ) : (
              <div className={cls}>{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
