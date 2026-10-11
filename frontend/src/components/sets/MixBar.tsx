import { useI18n } from '@/lib/i18n'
import type { Mix } from '@/lib/sets'

/** One stacked bar: share of empty, half full and full areas. */
export function MixBar({ mix }: { mix: Mix }) {
  const { t } = useI18n()
  const parts = [
    { key: 'empty', label: t.empty, pct: mix.empty_pct, cls: 'bg-danger' },
    { key: 'half', label: t.half, pct: mix.half_pct, cls: 'bg-warning' },
    { key: 'full', label: t.level.full, pct: mix.full_pct, cls: 'bg-success' },
  ]
  return (
    <div className="grid gap-2">
      <div className="flex h-5 w-full overflow-hidden rounded-md bg-sunk" role="img" aria-label={parts.map((p) => `${p.label} ${p.pct}%`).join(', ')}>
        {parts.map((p) => (
          <div key={p.key} className={p.cls} style={{ width: `${p.pct}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ui tabular-nums">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block size-2.5 rounded-sm ${p.cls}`} />
            {p.label} {p.pct}%
          </li>
        ))}
      </ul>
    </div>
  )
}
