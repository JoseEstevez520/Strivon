import { useI18n } from '@/lib/i18n'
import type { SetDetail } from '@/lib/sets'

const num = 'px-3 py-2 text-right tabular-nums'

/** Sets side by side: one column per set, one row per figure. */
export function CompareTable({ sets }: { sets: SetDetail[] }) {
  const { t } = useI18n()
  const s = t.sets
  const dash = '–'
  const rows: { label: string; cell: (d: SetDetail) => string }[] = [
    { label: s.colImages, cell: (d) => String(d.totals?.images ?? dash) },
    { label: s.colAreas, cell: (d) => String(d.totals?.areas ?? dash) },
    { label: t.empty, cell: (d) => (d.totals ? `${d.totals.empty_pct}%` : dash) },
    { label: t.half, cell: (d) => (d.totals ? `${d.totals.half_pct}%` : dash) },
    { label: t.level.full, cell: (d) => (d.totals ? `${d.totals.full_pct}%` : dash) },
    { label: s.colNotCompliant, cell: (d) => (d.totals ? `${d.totals.not_compliant_pct}%` : dash) },
    { label: s.scoreTitle, cell: (d) => (d.score ? s.scoreOf(d.score.total, d.score.max, String(d.score.percent)) : dash) },
    { label: s.identification, cell: (d) => (d.score ? `${d.score.ident_pct}%` : dash) },
    { label: s.stock, cell: (d) => (d.score ? `${d.score.stock_pct}%` : dash) },
    { label: s.errBelow(0).replace(/^0 /, ''), cell: (d) => (d.score ? String(d.score.below) : dash) },
    { label: s.errAbove(0).replace(/^0 /, ''), cell: (d) => (d.score ? String(d.score.above) : dash) },
  ]
  return (
    <section className="grid gap-2">
      <h2 className="text-title">{s.compare}</h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-raised">
        <table className="w-full text-ui" style={{ minWidth: `${10 + sets.length * 8}rem` }}>
          <thead>
            <tr className="text-fg-secondary">
              <th className="px-3 py-2 text-left font-medium" />
              {sets.map((d) => (
                <th key={d.id} className="px-3 py-2 text-right font-medium">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-[inherit]">
                  {r.label}
                </th>
                {sets.map((d) => (
                  <td key={d.id} className={num}>
                    {r.cell(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
