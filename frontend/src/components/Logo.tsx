const GRID = [
  [3, 2, 0],
  [1, 3, 2],
  [0, 1, 3],
]
// The day map's slots in miniature: grey where nothing is wrong, and a stretch of gone ones running
// corner to corner. Red is kept for those, as everywhere else.
const FILL = ['var(--sunk)', 'color-mix(in oklab, var(--danger) 28%, var(--sunk))', 'color-mix(in oklab, var(--danger) 52%, var(--sunk))', 'var(--danger)']

/** The mark: a 3×3 of day-map slots. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      {GRID.flatMap((row, y) =>
        row.map((v, x) => <rect key={`${x}-${y}`} x={x * 11.5} y={y * 11.5} width={9} height={9} rx={2.2} style={{ fill: FILL[v] }} />),
      )}
    </svg>
  )
}
