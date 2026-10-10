import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface PickerOption {
  value: string
  label: string
  /** Quiet text at the right of the option, such as a count. */
  hint?: string
  /** Shown before the label, in the list and on the trigger when chosen. */
  icon?: ReactNode
  /** A second line under the label, such as a strip of states. */
  extra?: ReactNode
}

interface Props {
  icon: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: PickerOption[]
  /** The trigger's width, which the open list repeats exactly. */
  className?: string
  /** Show only the icon on the trigger. The open list still shows icon and name. */
  iconOnly?: boolean
}

/** A tray that opens a short list. Used for the camera and the language. */
export function PickerButton({ icon, label, value, onChange, options, className, iconOnly = false }: Props) {
  const items = options.map((o) => ({ value: o.value, label: o.label }))
  const chosen = options.find((o) => o.value === value)
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label} className={className}>
        <span className="flex text-fg-muted [&_svg:not(.flag)]:size-4">{chosen?.icon ?? icon}</span>
        <SelectValue className={iconOnly ? 'sr-only' : undefined} />
      </SelectTrigger>
      <SelectContent align="end" className={iconOnly ? "w-auto min-w-44" : undefined}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-center gap-2">
                {o.icon}
                <span className="truncate">{o.label}</span>
              </span>
              {o.extra}
            </span>
            {o.hint && <span className="text-meta tabular-nums text-fg-muted">{o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
