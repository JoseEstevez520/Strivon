import { GROUP_COLOR } from './groupStyle'
import { ProductIcon } from './ProductIcon'
import { useI18n } from '@/lib/i18n'
import type { Group, Task } from '@/lib/tasks'

/** How a state looks on a tile: a tint behind the product and the colour of its icon. */
const LOOK: Record<Group, { bg: string; ink: string }> = {
  restock: { bg: 'color-mix(in oklab, var(--danger) 30%, var(--raised))', ink: 'var(--danger)' },
  moveBack: { bg: 'color-mix(in oklab, var(--warning) 28%, var(--raised))', ink: 'var(--warning)' },
  later: { bg: 'var(--sunk)', ink: 'var(--fg-muted)' },
  allGood: { bg: 'var(--raised)', ink: 'var(--fg-muted)' },
}

/**
 * A gondola as a card of its shelf areas: the icon of the product in each, on a tint that says what
 * it needs. Red is empty and the product is missing, amber is the wrong product in its place, grey
 * is half full, and white is fine. One tile for each area, in the order they sit on the shelf.
 */
export function ShelfCard({ tasks, className = '' }: { tasks: Task[]; className?: string }) {
  const { t, family } = useI18n()
  const own = [...tasks].sort((a, b) => a.area.index - b.area.index)
  return (
    <ul className={`grid gap-2 ${className}`} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(4.75rem, 1fr))' }}>
      {own.map((x) => {
        const look = LOOK[x.group]
        const name = family(x.area.family)
        return (
          <li
            key={x.area.area_id}
            title={`${name} · ${t.level[x.obs.stock_level]}${x.group === 'moveBack' ? ` · ${t.wrongProduct}` : ''}`}
            className="flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 pt-2.5 pb-1.5"
            style={{ background: look.bg }}
          >
            <span className="relative" style={{ color: look.ink, opacity: x.group === 'later' ? 0.7 : 1 }}>
              <ProductIcon family={x.area.family} label={name} className="size-8" />
              {x.group === 'restock' && (
                <span className="absolute -right-1.5 -bottom-1 grid size-3.5 place-items-center rounded-full bg-[var(--danger)] text-[10px] leading-none font-bold text-white" aria-hidden>
                  !
                </span>
              )}
              {x.group === 'moveBack' && (
                <span className="absolute -right-1.5 -bottom-1 grid size-3.5 place-items-center rounded-full bg-[var(--warning)] text-[10px] leading-none font-bold text-white" aria-hidden>
                  ↩
                </span>
              )}
            </span>
            <span className="line-clamp-2 min-h-7 w-full text-center text-[11px] leading-[14px] text-fg-secondary">{name}</span>
            {x.group === 'later' && <span className="h-0.5 w-5 rounded-full" style={{ background: GROUP_COLOR.later }} aria-hidden />}
          </li>
        )
      })}
    </ul>
  )
}
