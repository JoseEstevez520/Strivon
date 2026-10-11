import { useState } from 'react'
import { ProductIcon } from '@/components/ProductIcon'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import type { Task } from '@/lib/tasks'

interface Item {
  family: string
  areas: number
  cameras: string[]
  urgency: number
}

/** Products grouped with the gondolas they are for, the most gone from the store first. */
function group(tasks: Task[], pick: (x: Task) => string | undefined): Item[] {
  const m = new Map<string, Item>()
  for (const x of tasks) {
    const family = pick(x)
    if (!family) continue
    const item = m.get(family) ?? { family, areas: 0, cameras: [], urgency: 0 }
    item.areas += 1
    if (!item.cameras.includes(x.area.camera)) item.cameras.push(x.area.camera)
    item.urgency = Math.max(item.urgency, x.urgency)
    m.set(family, item)
  }
  return [...m.values()].sort((a, b) => b.urgency - a.urgency || b.areas - a.areas)
}

/**
 * What to carry, by product: one pass through the back room. Plain rows, no badges: the icon, the
 * name, and under it how many areas and which gondolas. Products in the wrong place are a second,
 * shorter list because they are moved inside the store and do not come from the back.
 */
export function BringList({ tasks }: { tasks: Task[] }) {
  const { t, family } = useI18n()
  const { gondola } = useStore()
  const [all, setAll] = useState(false)
  const bring = group(tasks.filter((x) => x.group === 'restock'), (x) => x.area.family)
  const back = group(tasks.filter((x) => x.group === 'moveBack'), (x) => x.obs.observed_family)
  const shown = all ? bring : bring.slice(0, 8)
  const where = (cameras: string[]) => (cameras.length === 1 ? gondola(cameras[0]) : `${t.navGondolas} ${cameras.map((c) => gondola(c).match(/\d+$/)?.[0] ?? c).join(' · ')}`)

  const rows = (items: Item[], withAreas: boolean) => (
    <ul className="flex flex-col">
      {items.map((x) => (
        <li key={x.family} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
          <ProductIcon family={x.family} label={family(x.family)} className="size-8 shrink-0 text-fg-secondary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label">{family(x.family)}</span>
            <span className="block text-meta tabular-nums text-fg-secondary">{withAreas ? `${t.areasCount(x.areas)} · ${where(x.cameras)}` : where(x.cameras)}</span>
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-5">
      {bring.length > 0 && (
        <section>
          <h3 className="px-2 pb-1 text-meta text-fg-muted">{t.bringFromBack}</h3>
          {rows(shown, true)}
          {bring.length > 8 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-1 h-10 w-full cursor-pointer rounded-xl text-ui text-fg-secondary transition-colors hover:bg-surface">
              {all ? t.showFewer : t.showMore(bring.length - 8)}
            </button>
          )}
        </section>
      )}
      {back.length > 0 && (
        <section>
          <h3 className="px-2 pb-1 text-meta text-fg-muted">{t.putBackHeading}</h3>
          {rows(back, false)}
        </section>
      )}
    </div>
  )
}
