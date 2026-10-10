import { clock } from '@/lib/time'

/**
 * A line over the hours of the period: how much of something was empty at each. One colour, the
 * outcome's, with a faint fill under the line. A gap where no camera was looking.
 */
export function TrendChart({ hours, values, label }: { hours: number[]; values: (number | null)[]; label: string }) {
  const W = 600
  const H = 170
  const pad = { l: 34, r: 8, t: 8, b: 22 }
  const top = Math.max(0.1, Math.ceil(Math.max(...values.map((v) => v ?? 0)) * 10) / 10)
  const x = (i: number) => pad.l + (hours.length > 1 ? (i / (hours.length - 1)) * (W - pad.l - pad.r) : 0)
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b)

  // Break the line where there is no value, so a gap is not drawn as a trend.
  const runs: { i: number; v: number }[][] = []
  values.forEach((v, i) => {
    if (v === null) return
    if (i > 0 && values[i - 1] !== null) runs[runs.length - 1].push({ i, v })
    else runs.push([{ i, v }])
  })
  const line = (r: { i: number; v: number }[]) => r.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = (r: { i: number; v: number }[]) =>
    `${line(r)} L${x(r[r.length - 1].i).toFixed(1)},${y(0).toFixed(1)} L${x(r[0].i).toFixed(1)},${y(0).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--sunk)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" className="fill-fg-muted text-[10px] tabular-nums">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      {hours.map((h, i) =>
        i % 2 === 0 ? (
          <text key={h} x={x(i)} y={H - 6} textAnchor="middle" className="fill-fg-muted text-[10px] tabular-nums">
            {clock(h).slice(0, 2)}
          </text>
        ) : null,
      )}
      {runs.map((r, k) => (
        <g key={k}>
          {r.length > 1 && <path d={area(r)} style={{ fill: 'color-mix(in oklab, var(--danger) 12%, transparent)' }} />}
          <path d={line(r)} fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {r.length === 1 && <circle cx={x(r[0].i)} cy={y(r[0].v)} r={3} fill="var(--danger)" />}
        </g>
      ))}
    </svg>
  )
}
