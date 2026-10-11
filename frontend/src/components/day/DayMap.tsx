import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'
import type { MapRow } from '@/lib/stats'

/** Four steps of one hue, by thirds of the areas that were empty. Nothing empty is a quiet tone. */
function tone(share: number | null): string {
  if (share === null) return 'transparent'
  if (share === 0) return 'var(--sunk)'
  const pct = share <= 1 / 3 ? 30 : share <= 2 / 3 ? 55 : 85
  return `color-mix(in oklab, var(--danger) ${pct}%, var(--sunk))`
}

/**
 * Products as rows and hours as columns, one red hue for how much of a product was empty. A cell
 * with no camera looking at it stays blank. The most affected products show first and the rest fold.
 */
export function DayMap({ rows, hours, limit = 10, linkTo }: { rows: MapRow[]; hours: number[]; limit?: number; linkTo?: (product: string) => string }) {
  const { t, family } = useI18n()
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, limit)
  const columns = `minmax(5.5rem,9rem) repeat(${hours.length}, minmax(0, 1fr))`

  return (
    <div role="group" aria-label={t.mapTitle}>
      <div className="grid items-end gap-x-[3px] pb-1.5" style={{ gridTemplateColumns: columns }}>
        <span />
        {hours.map((h, i) => (
          <span key={h} className="text-meta tabular-nums text-fg-muted">
            {i % 2 === 0 ? clock(h).slice(0, 2) : ''}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-[3px]">
        {shown.map((row) => (
          <div key={row.product} className="grid items-center gap-x-[3px]" style={{ gridTemplateColumns: columns }}>
            {linkTo ? (
              <Link to={linkTo(row.product)} className="truncate pr-2 text-meta text-fg-secondary transition-colors hover:text-fg">
                {family(row.product)}
              </Link>
            ) : (
              <span className="truncate pr-2 text-meta text-fg-secondary">{family(row.product)}</span>
            )}
            {/* one cell for every hour in the header, whatever the row holds, so the columns line up */}
            {hours.map((hour, i) => {
              const share = row.cells[i] ?? null
              return (
                <span
                  key={hour}
                  className="h-4 rounded-[3px]"
                  style={{ backgroundColor: tone(share) }}
                  title={share === null ? undefined : t.mapCell(family(row.product), clock(hour), Math.round(share * 100))}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        {rows.length > limit ? (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-meta text-fg-secondary transition-colors hover:bg-surface"
          >
            {all ? t.showFewer : t.showMore(rows.length - limit)}
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${all ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-2 text-meta text-fg-muted" aria-hidden>
          {t.mapLess}
          {[0, 1 / 4, 1 / 2, 1].map((s) => (
            <span key={s} className="size-3 rounded-[3px]" style={{ backgroundColor: tone(s) }} />
          ))}
          {t.mapMore}
        </span>
      </div>
    </div>
  )
}
