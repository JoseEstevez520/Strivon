import type { ReactNode } from 'react'

export interface SegmentOption {
  value: string
  label: ReactNode
  icon?: ReactNode
  /** Quiet figure after the label, such as a count. */
  hint?: ReactNode
  title?: string
}

interface Props {
  options: SegmentOption[]
  /** Whether an option is on. Several can be, so a filter and a switch use the same control. */
  on: (value: string) => boolean
  onPick: (value: string) => void
  label: string
  className?: string
  /** Keep every option at its natural width and scroll along the row instead of squeezing, for many short options. */
  scroll?: boolean
  /** On a phone, lay the options out two per row instead of squeezing them into one, for labels that are long. */
  wrap?: boolean
}

/**
 * A row of options that takes the whole width and splits it evenly. There is no tray around it:
 * the option that is on takes the tone of a card and the others stay on the page, so nothing
 * needs a border, a shadow or a dark fill.
 */
export function Segmented({ options, on, onPick, label, className = '', scroll = false, wrap = false }: Props) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${wrap ? 'grid grid-cols-2 sm:flex' : 'flex'} w-full gap-1 ${scroll ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''} ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          data-on={on(o.value)}
          aria-pressed={on(o.value)}
          onClick={() => onPick(o.value)}
          className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-ui whitespace-nowrap text-fg-secondary transition-colors hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-fg ${scroll ? 'min-w-fit shrink-0' : 'min-w-0'}`}
        >
          {o.icon}
          <span className="truncate">{o.label}</span>
          {o.hint !== undefined && <span className="text-meta tabular-nums text-fg-muted">{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}
