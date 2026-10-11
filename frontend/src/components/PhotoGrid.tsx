import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { PhotoStage } from '@/components/PhotoStage'
import { useStore } from '@/lib/store'
import { ACTION, snapshot, type Task } from '@/lib/tasks'

/**
 * The latest photo of every gondola with what is wrong marked on it, problems first in the order
 * of the round and the fine ones after. Pressing a photo opens that gondola.
 */
export function PhotoGrid({ order, byCamera, rankOf }: { order: string[]; byCamera: Record<string, Task[]>; rankOf: (camera: string) => number }) {
  const { state, at, gondola, photoUrl } = useStore()
  const none = useMemo(() => () => undefined, [])
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 min-[1700px]:grid-cols-4">
      {order.map((c) => {
        const own = byCamera[c] ?? []
        const rank = rankOf(c)
        const fine = !own.some((x) => ACTION.includes(x.group))
        const photo = snapshot(state, c, at)
        return (
          <li key={c}>
            <Link to={`/gondolas/${c}`} className="group block rounded-xl transition-opacity hover:opacity-90">
              <PhotoStage tasks={own} selected={null} onSelect={none} src={photoUrl?.(c, photo.image)} marks badge={2.2} lazy />
              <span className="mt-2 flex items-center gap-2 px-0.5">
                {rank > 0 && (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full text-meta tabular-nums text-fg-secondary" style={{ background: 'var(--sunk)' }}>
                    {rank}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-label">{gondola(c)}</span>
                {fine && <Check className="size-4 shrink-0" style={{ color: 'var(--success)' }} strokeWidth={3} aria-hidden />}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
