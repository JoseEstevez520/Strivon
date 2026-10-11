import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search, Undo2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { ProductIcon } from '@/components/ProductIcon'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cameras, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--raised))`

const VALUE = { empty: 0, half: 0.5, full: 1 } as const

type Status = 'all' | 'empty' | 'wrong' | 'half'
const STATUS: Status[] = ['all', 'empty', 'wrong', 'half']

/** What a task says about its product, for the filter. */
const statusOf = (x: Task): Exclude<Status, 'all'> | 'fine' =>
  !x.obs.planogram_compliant ? 'wrong' : x.obs.stock_level === 'empty' ? 'empty' : x.obs.stock_level === 'half' ? 'half' : 'fine'

interface Row {
  product: string
  tasks: Task[]
  /** Average stock over all its areas, 0 to 1. A misplaced area counts as empty. */
  fill: number
  short: number
}


/** One area of a product as a small square, with the same shape per state as the shelves: "!" empty, an arrow for a wrong product, half filled, plain when fine. */
function Cell({ task }: { task: Task }) {
  const { t } = useI18n()
  const { gondola } = useStore()
  const look = statusOf(task)
  const word = look === 'empty' ? t.level.empty : look === 'wrong' ? t.wrongProduct : look === 'half' ? t.level.half : t.level.full
  const bg = look === 'empty' ? mix('var(--danger)', 22) : look === 'wrong' ? mix('var(--warning)', 30) : 'var(--raised)'
  return (
    <Link
      to={`/gondolas/${task.area.camera}?area=${task.area.area_id}`}
      title={`${gondola(task.area.camera)} · ${word}`}
      aria-label={`${gondola(task.area.camera)} · ${word}`}
      className="relative grid size-5 place-items-center overflow-hidden rounded-[5px] transition-opacity hover:opacity-70"
      style={{ background: bg, color: look === 'empty' ? 'var(--danger)' : 'var(--warning)' }}
    >
      {look === 'half' && <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: mix('var(--fg)', 13) }} />}
      {look === 'empty' && <span className="text-[11px] leading-none font-bold">!</span>}
      {look === 'wrong' && <Undo2 className="size-3" strokeWidth={3} aria-hidden />}
    </Link>
  )
}

/**
 * One product as a card with four fixed places, so every card has the same shape: who it is, one
 * square per area in the state it is in, what to do and where, and since when. A line appears only
 * when it has news.
 */
function ProductCard({ row, focused }: { row: Row; focused: boolean }) {
  const { t, family } = useI18n()
  const { gondola } = useStore()
  const ref = useRef<HTMLLIElement>(null)
  // Arriving from a link to this product: bring it into view.
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' })
  }, [focused])
  const name = family(row.product)
  const cells = useMemo(
    () => [...row.tasks].sort((a, b) => Number(a.area.camera) - Number(b.area.camera) || a.area.index - b.area.index),
    [row.tasks],
  )
  const where = (st: 'empty' | 'wrong') => [...new Set(cells.filter((x) => statusOf(x) === st).map((x) => x.area.camera))].map((c) => gondola(c).match(/\d+$/)?.[0] ?? c)
  const bring = where('empty')
  const back = where('wrong')
  const since = Math.min(...cells.filter((x) => statusOf(x) === 'empty' && x.since !== null).map((x) => x.since as number))
  const chip = (c: string, bg: string) => (
    <span key={c} className="grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-meta font-medium tabular-nums text-fg-secondary" style={{ background: bg }}>
      {c}
    </span>
  )

  return (
    <li
      ref={ref}
      data-focus={focused}
      title={t.onShelf(Math.round(row.fill * 100))}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 transition-colors hover:bg-raised data-[focus=true]:bg-raised"
    >
      <div className="flex items-center gap-3">
        <ProductIcon family={cells[0]?.area.family ?? row.product} label={name} className="size-8 shrink-0 text-fg-secondary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label">{name}</span>
          <span className="block text-meta tabular-nums text-fg-secondary">{t.areasCount(cells.length)}</span>
        </span>
      </div>
      <div className="flex min-h-5 flex-wrap gap-1">
        {cells.map((x) => (
          <Cell key={x.area.area_id} task={x} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        {bring.length + back.length === 0 ? (
          <span className="flex h-6 items-center gap-1.5 text-meta text-fg-secondary">
            <Check className="size-4" style={{ color: 'var(--success)' }} strokeWidth={3} aria-hidden />
            {t.shortOf(0, cells.length)}
          </span>
        ) : (
          <>
            {bring.length > 0 && (
              <span className="flex flex-wrap items-center gap-1 text-meta text-fg-secondary">
                <span className="mr-1">{t.bringTo}</span>
                {bring.map((c) => chip(c, mix('var(--danger)', 16)))}
              </span>
            )}
            {back.length > 0 && (
              <span className="flex flex-wrap items-center gap-1 text-meta text-fg-secondary">
                <Undo2 className="size-3.5" style={{ color: 'var(--warning)' }} strokeWidth={3} aria-hidden />
                <span className="mr-1">{t.putBackIn}</span>
                {back.map((c) => chip(c, mix('var(--warning)', 26)))}
              </span>
            )}
          </>
        )}
        {Number.isFinite(since) && <span className="text-meta tabular-nums text-fg-muted">{t.emptySince(clock(since))}</span>}
      </div>
    </li>
  )
}

/** Stock per product across the store, the ones running out first. */
export function ProductsPage() {
  const { t, family } = useI18n()
  const { state, tasks, gondola } = useStore()
  const [query, setQuery] = useState('')
  // Several states or gondolas can be on at once; none on means all.
  const [status, setStatus] = useState<Set<Exclude<Status, 'all'>>>(new Set())
  const [camera, setCamera] = useState<Set<string>>(new Set())
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set)
    if (!next.delete(v)) next.add(v)
    return next
  }
  const [fine, setFine] = useState(false)
  const focus = useSearchParams()[0].get('product')

  // The gondola narrows the areas first, so a product's figure is its stock in that gondola.
  const inCamera = useMemo(() => (camera.size === 0 ? tasks : tasks.filter((x) => camera.has(x.area.camera))), [tasks, camera])

  const rows = useMemo<Row[]>(() => {
    const byProduct = new Map<string, Task[]>()
    for (const task of inCamera) byProduct.set(task.area.product_id, [...(byProduct.get(task.area.product_id) ?? []), task])
    return [...byProduct.entries()]
      .map(([product, list]) => ({
        product,
        tasks: list,
        fill: list.reduce((sum, x) => sum + (x.obs.planogram_compliant ? VALUE[x.obs.stock_level] : 0), 0) / list.length,
        short: list.filter((x) => ACTION.includes(x.group)).length,
      }))
      .sort((a, b) => a.fill - b.fill || b.short - a.short)
  }, [inCamera])

  const q = query.trim().toLowerCase()
  const withStatus = (st: Status) => (st === 'all' ? rows : rows.filter((r) => r.tasks.some((x) => statusOf(x) === st)))
  const named = q ? rows.filter((r) => family(r.product).toLowerCase().includes(q)) : rows
  const shown = status.size === 0 ? named : named.filter((r) => r.tasks.some((x) => (status as Set<string>).has(statusOf(x))))
  // With no filter and no search, the products with nothing to do wait behind one line.
  const quiet = (r: Row) => r.tasks.every((x) => statusOf(x) === 'fine')
  const fold = status.size === 0 && q === '' && !fine
  const listed = fold ? shown.filter((r) => !quiet(r) || r.product === focus) : shown
  const label = (st: Status) => (st === 'all' ? t.all : st === 'empty' ? t.level.empty : st === 'wrong' ? t.wrongProduct : t.level.half)

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-display">{t.productsToRestock(rows.filter((r) => r.short > 0).length)}</h1>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchProducts}
            aria-label={t.searchProducts}
            className="pl-9"
          />
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label={t.filterState}>
          {STATUS.map((st) => (
            <button
              key={st}
              type="button"
              data-on={st === 'all' ? status.size === 0 : status.has(st)}
              aria-pressed={st === 'all' ? status.size === 0 : status.has(st)}
              onClick={() => setStatus(st === 'all' ? new Set() : toggle(status, st))}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-fg"
            >
              {label(st)}
              <span className="text-meta tabular-nums text-fg-muted">{withStatus(st).length}</span>
            </button>
          ))}
        </div>
        {/* Fourteen gondolas are too many names for a list that hides, and the numbers are short: one row that scrolls on a phone. */}
        <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={t.allGondolas}>
          {['all', ...cameras(state)].map((c) => (
            <button
              key={c}
              type="button"
              data-on={c === 'all' ? camera.size === 0 : camera.has(c)}
              aria-pressed={c === 'all' ? camera.size === 0 : camera.has(c)}
              title={c === 'all' ? t.allGondolas : gondola(c)}
              onClick={() => setCamera(c === 'all' ? new Set() : toggle(camera, c))}
              className="h-9 shrink-0 cursor-pointer rounded-lg px-3 text-ui tabular-nums text-fg-secondary transition-colors hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-fg"
            >
              {c === 'all' ? t.allGondolas : (gondola(c).match(/\d+$/)?.[0] ?? gondola(c))}
            </button>
          ))}
        </div>
      </div>
      <DayBar className="mb-6" />
      {shown.length === 0 ? (
        <p className="text-ui text-fg-secondary">{t.noMatches}</p>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(16.5rem,1fr))] gap-4">
            {listed.map((r) => (
              <ProductCard key={r.product} row={r} focused={r.product === focus} />
            ))}
          </ul>
          {shown.length > listed.length && (
            <button type="button" onClick={() => setFine(true)} className="mt-3 h-10 w-full cursor-pointer rounded-xl text-ui text-fg-secondary transition-colors hover:bg-surface">
              {t.showFine(shown.length - listed.length)}
            </button>
          )}
        </>
      )}
    </>
  )
}
