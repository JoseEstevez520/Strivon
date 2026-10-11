import { useI18n } from '@/lib/i18n'
import type { StockCounts, ValidationSummary } from '@/lib/validation'

const num = 'px-3 py-2 text-right tabular-nums'

function Row({ name, c, strong }: { name: string; c: StockCounts; strong?: boolean }) {
  return (
    <tr className={`border-t border-line ${strong ? 'bg-surface font-medium' : ''}`}>
      <th scope="row" className="px-3 py-2 text-left font-[inherit]">
        {name}
      </th>
      <td className={num}>{c.empty}</td>
      <td className={num}>{c.half}</td>
      <td className={num}>{c.full}</td>
      <td className={num}>{c.non_compliant}</td>
    </tr>
  )
}

export function SummaryTable({ summary }: { summary: ValidationSummary }) {
  const { t } = useI18n()
  return (
    <div className="grid min-w-0 gap-2">
      <h3 className="text-label text-fg">{t.validate.perCamera}</h3>
      <div className="max-w-full overflow-x-auto rounded-lg border border-line bg-raised">
        <table className="w-full min-w-[22rem] text-ui">
          <thead>
            <tr className="text-fg-secondary">
              <th className="px-3 py-2 text-left font-medium">{t.camera}</th>
              <th className="px-3 py-2 text-right font-medium">{t.empty}</th>
              <th className="px-3 py-2 text-right font-medium">{t.half}</th>
              <th className="px-3 py-2 text-right font-medium">{t.level.full}</th>
              <th className="px-3 py-2 text-right font-medium">{t.validate.notCompliant}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.cameras)
              .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
              .map(([cam, c]) => (
                <Row key={cam} name={cam} c={c} />
              ))}
            <Row name={t.validate.total} c={summary.totals} strong />
          </tbody>
        </table>
      </div>
    </div>
  )
}
