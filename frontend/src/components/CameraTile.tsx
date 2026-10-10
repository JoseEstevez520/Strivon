import { CircleAlert, Undo2 } from 'lucide-react'
import { Link } from 'react-router'
import { GROUP_COLOR } from './groupStyle'
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
  // The loudest state in the gondola picks the icon: something to restock, then something misplaced.
  const worst = own.some((x) => x.group === 'restock') ? 'restock' : own.some((x) => x.group === 'moveBack') ? 'moveBack' : null
  const src = photoUrl?.(camera, snapshot(state, camera, at).image)
  const Icon = worst === 'restock' ? CircleAlert : Undo2

  return (
    <Link
      to={`/gondolas/${camera}`}
      className="flex h-full flex-col gap-2 rounded-xl bg-surface p-2 transition-colors hover:bg-raised"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#d6d8d0]">
        {src && <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="flex flex-col gap-2 px-1 pb-1">
        <span className="truncate text-label">{gondola(camera)}</span>
        <div className="flex items-center gap-3">
          {worst ? (
            <span className="flex shrink-0 items-center gap-1.5 text-meta font-medium tabular-nums text-fg-secondary">
              <Icon className="size-3.5" style={{ color: GROUP_COLOR[worst] }} />
              {t.toDo(pending)}
            </span>
          ) : (
            <span className="shrink-0 text-meta text-fg-muted">{t.allGood}</span>
          )}
          <StateStrip tasks={own} className="flex-1" />
        </div>
      </div>
    </Link>
  )
}
