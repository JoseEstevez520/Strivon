import { Check, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { PhotoStage } from '@/components/PhotoStage'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest, type Suggestion } from '@/lib/suggest'
import { cameras, snapshot } from '@/lib/tasks'
import { clock } from '@/lib/time'
import { AreaTile, isProblem, shelfOrder } from '@/pages/MapStorePage'

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--raised))`

/** A gondola as one row: its number, what is wrong in it as tiles, and since when. */
function Row({ s, on, rank, onPick, onOpen }: { s: Suggestion; on: boolean; rank: number; onPick: () => void; onOpen: () => void }) {
  const { t } = useI18n()
  const { tasks, gondola } = useStore()
  const problems = shelfOrder(tasks.filter((x) => x.area.camera === s.camera)).filter(isProblem)
  return (
    <button
      type="button"
      onClick={onPick}
      onDoubleClick={onOpen}
      data-on={on}
      className="flex w-full cursor-pointer items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-raised data-[on=true]:bg-raised"
      style={{ background: on ? undefined : 'color-mix(in oklab, var(--raised) 55%, var(--bg))' }}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full text-meta tabular-nums text-fg-secondary" style={{ background: 'var(--sunk)' }}>
        {rank}
      </span>
      <span className="w-36 shrink-0">
        <span className="block text-label">{gondola(s.camera)}</span>
        {s.emptySince !== null && <span className="block text-meta text-fg-muted">{t.emptySince(clock(s.emptySince))}</span>}
      </span>
      <span className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 34px))' }}>
        {problems.map((x) => (
          <AreaTile key={x.area.area_id} task={x} />
        ))}
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
    </button>
  )
}

/** The detail beside the list: the photo of the gondola picked, with what is wrong marked, and a way into its page. */
function Side({ camera }: { camera: string }) {
  const { t } = useI18n()
  const { state, tasks, at, gondola, photoUrl } = useStore()
  const own = tasks.filter((x) => x.area.camera === camera)
  const photo = snapshot(state, camera, at)
  return (
    <div>
      <Link to={`/gondolas/${camera}`} className="mb-2 flex h-9 items-center justify-between px-1 text-label text-fg-muted transition-colors hover:text-fg">
        {gondola(camera)}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
      <PhotoStage tasks={own} selected={null} src={photoUrl?.(camera, photo.image)} onSelect={() => {}} marks />
      <p className="mt-2 px-1 text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(photo.ts))}</p>
    </div>
  )
}

/** B: a short list of gondolas with the others folded away, and the photo of the one picked. */
function ListAndPhoto({ list }: { list: Suggestion[] }) {
  const [pick, setPick] = useState<string | null>(null)
  const current = pick ?? list[0]?.camera
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <ul className="flex flex-col gap-2">
        {list.map((s, i) => (
          <li key={s.camera}>
            <Row s={s} rank={i + 1} on={s.camera === current} onPick={() => setPick(s.camera)} onOpen={() => undefined} />
          </li>
        ))}
      </ul>
      <div className="lg:sticky lg:top-4">{current && <Side camera={current} />}</div>
    </div>
  )
}

/** C: two columns of gondolas, no detail: the second column continues the list. Pressing opens the page. */
function TwoColumns({ list }: { list: Suggestion[] }) {
  const { gondola } = useStore()
  const half = Math.ceil(list.length / 2)
  const col = (items: Suggestion[], from: number) => (
    <ul className="flex flex-col gap-2">
      {items.map((s, i) => (
        <li key={s.camera}>
          <Link to={`/gondolas/${s.camera}`} className="block" aria-label={gondola(s.camera)}>
            <Row s={s} rank={from + i + 1} on={false} onPick={() => undefined} onOpen={() => undefined} />
          </Link>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-2">
      {col(list.slice(0, half), 0)}
      {col(list.slice(half), half)}
    </div>
  )
}

const VERSIONS = [
  ['1', 'List and photo', 'One row per gondola in the order of the round, and the photo of the one you pick on the right. The first is picked.', ListAndPhoto],
  ['2', 'Two columns of gondolas', 'The same rows continued across the whole width, no photo. Pressing a row opens its page.', TwoColumns],
] as const

/** Two ways to make the first page a list of gondolas. Not in the menu: /lab/tasks. */
export function TasksLabPage() {
  const { tasks, state } = useStore()
  const [v, setV] = useState('1')
  // Only a gondola with something empty or in the wrong place is work; half full is not.
  const ranked = useMemo(() => suggest(tasks).filter((s) => s.empty + s.wrong > 0), [tasks])
  const fine = cameras(state).filter((c) => !ranked.some((s) => s.camera === c))
  const View = VERSIONS.find((x) => x[0] === v)![3]
  return (
    <>
      <h1 className="mb-1 text-display">{ranked.length === 0 ? 'Every gondola is fine' : `${ranked.length} gondolas need attention`}</h1>
      <DayBar className="mb-6" />
      <div className="mb-8 grid gap-2 sm:grid-cols-2">
        {VERSIONS.map(([k, title, text]) => (
          <button key={k} type="button" onClick={() => setV(k)} data-on={v === k} className="cursor-pointer rounded-xl bg-surface p-3 text-left transition-colors hover:bg-sunk data-[on=true]:bg-sunk">
            <span className="block text-label">{k} · {title}</span>
            <span className="mt-1 block text-meta text-fg-secondary">{text}</span>
          </button>
        ))}
      </div>
      <View list={ranked} />
      {fine.length > 0 && (
        <p className="mt-6 flex items-center gap-2 px-1 text-meta text-fg-muted">
          <Check className="size-4" style={{ color: mix('var(--success)', 100) }} strokeWidth={3} />
          {fine.length} gondolas with nothing to do
        </p>
      )}
    </>
  )
}
