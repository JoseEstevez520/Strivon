/** The one number that leads a page, written as a sentence, with an optional quiet note under it. */
export function StatLine({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div>
      <p className="text-display tabular-nums">{children}</p>
      {note && <p className="mt-1 text-meta text-fg-muted">{note}</p>}
    </div>
  )
}
