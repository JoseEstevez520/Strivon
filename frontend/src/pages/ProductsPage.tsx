import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { ProductIcon } from '@/components/ProductIcon'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cameras, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

const mix = (c: string, pct: number, base = 'var(--raised)') => `color-mix(in oklab, ${c} ${pct}%, ${base})`

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


const SEGMENTS = [
  { look: 'empty', color: 'var(--danger)' },
  { look: 'wrong', color: 'var(--warning)' },
  { look: 'half', color: mix('var(--fg)', 28, 'var(--surface)') },
  { look: 'fine', color: mix('var(--success)', 70, 'var(--surface)') },
] as const

/** The areas of a product as a ring split by state, with the number of areas in the middle. */
function Ring({ counts, total }: { counts: Record<string, number>; total: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  let at = 0
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunk)" strokeWidth="10" />
      {SEGMENTS.map(({ look, color }) => {
        const n = counts[look] ?? 0
        if (n === 0) return null
        const len = (n / total) * c
        const el = <circle key={look} cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`} strokeDashoffset={-at} />
        at += len
        return el
      })}
    </svg>
  )
}

/**
 * One product as a card with three places: who it is, a ring of its areas by state with a legend
 * that names each count, and where to go. Only the states it has appear in the legend.
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
  const total = row.tasks.length
  const counts: Record<string, number> = {}
  for (const x of row.tasks) counts[statusOf(x)] = (counts[statusOf(x)] ?? 0) + 1
  const word = (l: string) => (l === 'empty' ? t.level.empty : l === 'wrong' ? t.wrongProduct : l === 'half' ? t.level.half : t.level.full)
  const where = (st: 'empty' | 'wrong') => [...new Set(row.tasks.filter((x) => statusOf(x) === st).map((x) => x.area.camera))]
  const bring = where('empty')
  const back = where('wrong')
  const since = Math.min(...row.tasks.filter((x) => statusOf(x) === 'empty' && x.since !== null).map((x) => x.since as number))
  const links = (list: string[]) =>
    list.map((c, i) => (
      <span key={c}>
        {i > 0 && ', '}
        <Link to={`/gondolas/${c}`} className="text-fg underline-offset-2 hover:underline">
          {gondola(c).match(/\d+$/)?.[0] ?? c}
        </Link>
      </span>
    ))

  return (
    <li
      ref={ref}
      data-focus={focused}
      className="flex flex-col gap-4 rounded-2xl bg-surface p-4 transition-colors hover:bg-raised data-[focus=true]:bg-raised"
    >
      <div className="flex items-center gap-3">
        <ProductIcon family={row.tasks[0]?.area.family ?? row.product} label={name} className="size-8 shrink-0 text-fg-secondary" />
        <span className="min-w-0 flex-1 truncate text-label">{name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="relative grid shrink-0 place-items-center" role="img" aria-label={SEGMENTS.filter((x) => counts[x.look]).map((x) => `${counts[x.look]} ${word(x.look)}`).join(', ')}>
          <Ring counts={counts} total={total} />
          <span className="absolute text-label tabular-nums">{total}</span>
        </span>
        <ul className="flex min-w-0 flex-1 flex-col gap-1">
          {SEGMENTS.filter((x) => counts[x.look]).map((x) => (
            <li key={x.look} className="flex items-center gap-2 text-meta text-fg-secondary">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: x.color }} aria-hidden />
              <span className="w-4 tabular-nums text-fg">{counts[x.look]}</span>
              <span className="truncate">{word(x.look)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto flex flex-col gap-1 text-meta text-fg-secondary">
        {bring.length + back.length === 0 ? (
          <span className="flex items-center gap-1.5">
            <Check className="size-4" style={{ color: 'var(--success)' }} strokeWidth={3} aria-hidden />
            {t.shortOf(0, total)}
          </span>
        ) : (
          <>
            {bring.length > 0 && (
              <span>
                {t.bringTo} {links(bring)}
                {Number.isFinite(since) && <span className="text-fg-muted tabular-nums"> · {t.emptySince(clock(since))}</span>}
              </span>
            )}
            {back.length > 0 && (
              <span>
                {t.putBackIn} {links(back)}
              </span>
            )}
          </>
        )}
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
        <Segmented
          wrap
          label={t.filterState}
          options={STATUS.map((st) => ({ value: st, label: label(st), hint: withStatus(st).length }))}
          on={(v) => (v === 'all' ? status.size === 0 : status.has(v as Exclude<Status, 'all'>))}
          onPick={(v) => setStatus(v === 'all' ? new Set() : toggle(status, v as Exclude<Status, 'all'>))}
        />
        {/* Fourteen gondolas are too many names for a list that hides, and the numbers are short: one row that fills the width, and scrolls on a phone. */}
        <Segmented
          scroll
          label={t.allGondolas}
          options={['all', ...cameras(state)].map((c) => ({
            value: c,
            label: c === 'all' ? t.allGondolas : (gondola(c).match(/\d+$/)?.[0] ?? gondola(c)),
            title: c === 'all' ? t.allGondolas : gondola(c),
          }))}
          on={(v) => (v === 'all' ? camera.size === 0 : camera.has(v))}
          onPick={(v) => setCamera(v === 'all' ? new Set() : toggle(camera, v))}
        />
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
