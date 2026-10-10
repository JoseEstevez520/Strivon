import { Link } from 'react-router'
import { StateStrip } from './StateStrip'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, snapshot } from '@/lib/tasks'

/** One camera: its latest photo, what it is called, and how its shelves are doing. */
export function CameraTile({ camera }: { camera: string }) {
  const { t } = useI18n()
  const { state, at, tasks, gondola, photoUrl } = useStore()
  const own = tasks.filter((x) => x.area.camera === camera)
  const pending = own.filter((x) => ACTION.includes(x.group)).length
  const src = photoUrl?.(camera, snapshot(state, camera, at).image)

  return (
    <Link
      to={`/gondolas/${camera}`}
      className="flex h-full flex-col gap-2 rounded-xl bg-surface p-2 transition-colors hover:bg-raised"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#d6d8d0]">
        {src && <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-label">{gondola(camera)}</span>
        <span className="shrink-0 text-meta tabular-nums text-fg-secondary">{pending > 0 ? t.toDo(pending) : t.allGood}</span>
      </div>
      <div className="px-1 pb-1">
        <StateStrip tasks={own} />
      </div>
    </Link>
  )
}
