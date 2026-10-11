import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { ApiError } from '@/lib/validation'
import { postLabels, type SetDetail } from '@/lib/sets'

const btn =
  'inline-flex h-11 cursor-pointer items-center rounded-lg border border-line bg-raised px-4 text-label text-fg transition-colors hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-50'

function Part({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="grid gap-1 rounded-lg bg-surface p-3">
      <p className="text-ui text-fg-secondary">{title}</p>
      <p className="text-title tabular-nums">{value}</p>
      <p className="text-ui text-fg-secondary tabular-nums">{sub}</p>
    </div>
  )
}

export function ScorePanel({ set, onChanged }: { set: SetDetail; onChanged: () => void }) {
  const { t } = useI18n()
  const s = t.sets
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)
  const sc = set.score

  const send = async (body: () => Promise<Record<string, unknown> | { use: 'team' }>) => {
    setBusy(true)
    setNote(null)
    try {
      const r = await postLabels(set.id, await body())
      setNote({ text: s.labelsSaved(r.areas, r.dropped), bad: false })
      onChanged()
    } catch (e) {
      const why = e instanceof ApiError && e.kind === 'down' ? t.validate.backendDown : e instanceof Error ? e.message : String(e)
      setNote({ text: s.labelsFailed(why), bad: true })
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || set.status !== 'done'

  return (
    <section className="grid gap-3">
      <h3 className="text-label text-fg">{s.scoreTitle}</h3>
      {!sc && <p className="rounded-lg border border-line bg-surface px-3 py-2 text-ui text-fg-secondary">{s.noLabels}</p>}
      {sc && (
        <div className="grid gap-3">
          <p className="text-display tabular-nums">{s.scoreOf(sc.total, sc.max, String(sc.percent))}</p>
          <p className="text-meta text-fg-muted">{s.labelsFrom[sc.labels_source]}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Part title={s.identification} value={s.pointsOf(sc.ident, sc.ident_max, String(sc.ident_pct))} sub={s.correct(String(sc.ident_ok_pct))} />
            <Part title={s.stock} value={s.pointsOf(sc.stock, sc.stock_max, String(sc.stock_pct))} sub={s.correct(String(sc.stock_ok_pct))} />
          </div>
          <ul className="grid gap-1 text-ui tabular-nums">
            <li>{s.errBelow(sc.below)}</li>
            <li>{s.errAbove(sc.above)}</li>
            {sc.unlabelled > 0 && <li className="text-warning">{s.notScored(sc.unlabelled)}</li>}
            {sc.missing > 0 && <li className="text-danger">{s.missingAreas(sc.missing)}</li>}
          </ul>
          {sc.worst.length > 0 && (
            <div className="grid gap-2">
              <h4 className="text-label text-fg">{s.worst}</h4>
              <ul className="grid gap-2">
                {sc.worst.map((w) => (
                  <li key={`${w.camera}/${w.image}/${w.area}`} className="grid gap-0.5 rounded-lg border border-line bg-raised px-3 py-2 text-ui">
                    <p className="break-words font-medium">
                      {w.camera} · {w.image} · {w.area} <span className="text-danger tabular-nums">({w.points})</span>
                    </p>
                    <p className="text-fg-secondary tabular-nums">
                      {s.predicted}: {w.predicted ? `${w.predicted.compliant ? s.compliant : s.notCompliant}, ${w.predicted.stock}` : s.noPrediction}
                      {' · '}
                      {s.truth}: {w.true.compliant ? s.compliant : s.notCompliant}, {w.true.stock}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={disabled} onClick={() => send(async () => ({ use: 'team' as const }))}>
          {s.useTeam}
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => file.current?.click()}>
          {s.uploadLabels}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void send(async () => JSON.parse(await f.text()))
          }}
        />
      </div>
      {note && (
        <p role={note.bad ? 'alert' : 'status'} className={`text-ui ${note.bad ? 'text-danger' : 'text-fg-secondary'}`}>
          {note.text}
        </p>
      )}
    </section>
  )
}
