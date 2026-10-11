import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, Undo2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { ProductIcon } from '@/components/ProductIcon'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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

/** What a product's areas are doing, as small tinted counts. Fine ones say so quietly. */
function Counts({ tasks }: { tasks: Task[] }) {
  const { t } = useI18n()
  const n = (st: string) => tasks.filter((x) => statusOf(x) === st).length
  const empty = n('empty')
  const wrong = n('wrong')
  const half = n('half')
  const chip = 'flex h-6 items-center gap-1 rounded-md px-2 text-meta font-medium tabular-nums'
  if (empty + wrong + half === 0) {
    return (
      <span className="flex items-center gap-1 text-meta text-fg-muted">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        {t.level.full}
      </span>
    )
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {empty > 0 && (
        <span className={chip} style={{ background: mix('var(--danger)', 14), color: 'var(--danger)' }}>
          ×{empty} {t.level.empty}
        </span>
      )}
      {wrong > 0 && (
        <span className={chip} style={{ background: mix('var(--warning)', 26), color: 'var(--warning)' }}>
          <Undo2 className="size-3" aria-hidden />×{wrong} {t.wrongProduct}
        </span>
      )}
      {half > 0 && (
        <span className={`${chip} text-fg-secondary`} style={{ background: 'var(--sunk)' }}>
          ×{half} {t.level.half}
        </span>
      )}
    </span>
  )
}

/** One product summed over every area it sits in: its icon, what is wrong with it, and the gondolas on demand. */
function ProductRow({ row, focused }: { row: Row; focused: boolean }) {
  const { t, family } = useI18n()
  const { gondola } = useStore()
  const [open, setOpen] = useState(focused)
  const ref = useRef<HTMLLIElement>(null)
  // Arriving from a link to this product: bring it into view.
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' })
  }, [focused])
  const name = family(row.product)

  return (
    <li ref={ref} className="rounded-xl transition-colors hover:bg-surface data-[open=true]:bg-surface" data-open={open}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left">
          <ProductIcon family={row.tasks[0]?.area.family ?? row.product} label={name} className="size-8 shrink-0 text-fg-secondary" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-label">{name}</span>
            <Counts tasks={row.tasks} />
          </span>
          <ChevronDown className="size-4 shrink-0 text-fg-muted transition-transform data-[open=true]:rotate-180" data-open={open} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="px-3 pb-1 text-meta tabular-nums text-fg-muted">{t.onShelf(Math.round(row.fill * 100))}</p>
          <ul className="px-1 pb-2">
            {row.tasks.map((task) => (
              <li key={task.area.area_id}>
                <Link
                  to={`/gondolas/${task.area.camera}?area=${task.area.area_id}`}
                  className="flex items-baseline justify-between gap-3 rounded-md px-2 py-2 text-ui text-fg-secondary transition-colors hover:bg-raised/70"
                >
                  <span className="min-w-0 truncate text-fg">{gondola(task.area.camera)}</span>
                  <span className="text-meta tabular-nums">
                    {task.obs.planogram_compliant ? t.level[task.obs.stock_level] : t.wrongPlace(family(task.obs.observed_family ?? ''))}
                    {' · '}
                    {clock(task.record.ts)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
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
          <ul className="flex flex-col gap-0.5">
            {listed.map((r) => (
              <ProductRow key={r.product} row={r} focused={r.product === focus} />
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
