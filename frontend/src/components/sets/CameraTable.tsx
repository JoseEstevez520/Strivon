import { useI18n } from '@/lib/i18n'
import type { Mix, SetScore } from '@/lib/sets'

const num = 'px-3 py-2 text-right tabular-nums'
const byCam = ([a]: [string, unknown], [b]: [string, unknown]) => a.localeCompare(b, undefined, { numeric: true })

function Row({ name, m, score, strong }: { name: string; m: Mix; score?: { total: number; max: number; percent: number }; strong?: boolean }) {
  return (
    <tr className={`border-t border-line ${strong ? 'bg-surface font-medium' : ''}`}>
      <th scope="row" className="px-3 py-2 text-left font-[inherit]">
        {name}
      </th>
      <td className={num}>{m.images}</td>
      <td className={num}>{m.empty_pct}%</td>
      <td className={num}>{m.half_pct}%</td>
      <td className={num}>{m.full_pct}%</td>
      <td className={num}>{m.not_compliant_pct}%</td>
      {score !== undefined && (
        <td className={num}>
          {score.percent}% <span className="text-fg-muted">({score.total}/{score.max})</span>
        </td>
      )}
    </tr>
  )
}

export function CameraTable({ cameras, totals, score }: { cameras: Record<string, Mix>; totals: Mix; score: SetScore | null }) {
  const { t } = useI18n()
  const s = t.sets
  return (
    <div className="grid gap-2">
      <h3 className="text-label text-fg">{t.validate.perCamera}</h3>
      <div className="overflow-x-auto rounded-lg border border-line bg-raised">
        <table className="w-full min-w-[30rem] text-ui">
          <thead>
            <tr className="text-fg-secondary">
              <th className="px-3 py-2 text-left font-medium">{t.camera}</th>
              <th className="px-3 py-2 text-right font-medium">{s.colImages}</th>
              <th className="px-3 py-2 text-right font-medium">{t.empty}</th>
              <th className="px-3 py-2 text-right font-medium">{t.half}</th>
              <th className="px-3 py-2 text-right font-medium">{t.level.full}</th>
              <th className="px-3 py-2 text-right font-medium">{s.colNotCompliant}</th>
              {score && <th className="px-3 py-2 text-right font-medium">{s.colScore}</th>}
            </tr>
          </thead>
          <tbody>
            {Object.entries(cameras)
              .sort(byCam)
              .map(([cam, m]) => (
                <Row key={cam} name={cam} m={m} score={score ? score.cameras[cam] : undefined} />
              ))}
            <Row name={t.validate.total} m={totals} score={score ?? undefined} strong />
          </tbody>
        </table>
      </div>
    </div>
  )
}
