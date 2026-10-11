import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PickerButton } from '@/components/PickerButton'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cameras, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

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

/** The state of a product summed over every area it sits in. */
function ProductRow({ row, focused }: { row: Row; focused: boolean }) {
  const { t, family } = useI18n()
  const { gondola } = useStore()
  const [open, setOpen] = useState(focused)
  const ref = useRef<HTMLLIElement>(null)
  // Arriving from a link to this product: bring it into view.
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' })
  }, [focused])
  const percent = Math.round(row.fill * 100)
  const tone = row.fill >= 0.7 ? 'var(--success)' : row.fill >= 0.35 ? 'var(--warning)' : 'var(--danger)'

  return (
    <li ref={ref} className="rounded-lg transition-colors hover:bg-surface data-[open=true]:bg-surface" data-open={open}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-3 py-2.5 text-left sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_3rem]">
          <span>
            <span className="block text-label">{family(row.product)}</span>
            <span className="block text-meta text-fg-secondary">{t.shortOf(row.short, row.tasks.length)}</span>
          </span>
          <span className="order-3 col-span-2 h-1.5 overflow-hidden rounded-full bg-sunk sm:order-none sm:col-span-1" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: tone }} />
          </span>
          <span className="text-right text-meta tabular-nums text-fg-secondary">{percent}%</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="px-1 pb-2">
            {row.tasks.map((task) => (
              <li key={task.area.area_id}>
                <Link
                  to={`/gondolas/${task.area.camera}?area=${task.area.area_id}`}
                  className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-ui text-fg-secondary transition-colors hover:bg-raised/70"
                >
                  <span className="min-w-0 truncate">{gondola(task.area.camera)}</span>
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
  const [status, setStatus] = useState<Status>('all')
  const [camera, setCamera] = useState('all')
  const focus = useSearchParams()[0].get('product')

  // The gondola narrows the areas first, so a product's figure is its stock in that gondola.
  const inCamera = useMemo(() => (camera === 'all' ? tasks : tasks.filter((x) => x.area.camera === camera)), [tasks, camera])

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
  const shown = status === 'all' ? named : named.filter((r) => r.tasks.some((x) => statusOf(x) === status))
  const label = (st: Status) => (st === 'all' ? t.all : st === 'empty' ? t.level.empty : st === 'wrong' ? t.wrongProduct : t.level.half)

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-display">{t.productsHeadline(rows.length)}</h1>
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1">
          {STATUS.map((st) => (
            <button
              key={st}
              type="button"
              data-on={status === st}
              onClick={() => setStatus(st)}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-fg"
            >
              {label(st)}
              <span className="text-meta tabular-nums text-fg-muted">{withStatus(st).length}</span>
            </button>
          ))}
        </div>
        <PickerButton
          icon={<LayoutGrid />}
          label={t.allGondolas}
          value={camera}
          onChange={setCamera}
          className="w-44"
          options={[{ value: 'all', label: t.allGondolas }, ...cameras(state).map((c) => ({ value: c, label: gondola(c) }))]}
        />
      </div>
      <DayBar className="mb-6" />
      {shown.length === 0 ? (
        <p className="text-ui text-fg-secondary">{t.noMatches}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((r) => (
            <ProductRow key={r.product} row={r} focused={r.product === focus} />
          ))}
        </ul>
      )}
    </>
  )
}
