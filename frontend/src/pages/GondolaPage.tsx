import { ChevronLeft } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { TaskBoard } from '@/components/TaskBoard'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'

/** One gondola: its photo with the shelf areas, and what is going on in each. */
export function GondolaPage() {
  const { t } = useI18n()
  const { camera = '' } = useParams()
  const [params] = useSearchParams()
  const { state, tasks, gondola, gondolaWhat } = useStore()

  if (!state.images[camera]) return <Navigate to="/gondolas" replace />

  return (
    <>
      <Link
        to="/gondolas"
        className="mb-3 inline-flex items-center gap-1 rounded-sm text-meta text-fg-muted transition-colors hover:text-fg-secondary"
      >
        <ChevronLeft className="size-3.5" />
        {t.allGondolas}
      </Link>
      <h1 className="text-display">{gondola(camera)}</h1>
      <p className="mt-1 mb-8 text-copy text-fg-muted">{gondolaWhat(camera)}</p>
      <TaskBoard
        key={camera}
        tasks={tasks.filter((x) => x.area.camera === camera)}
        camera={camera}
        listFine
        initialSelected={params.get('area')}
      />
    </>
  )
}
