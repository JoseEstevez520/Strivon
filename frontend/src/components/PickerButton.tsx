import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface PickerOption {
  value: string
  label: string
  /** Quiet text at the right of the option, such as a count. */
  hint?: string
}

interface Props {
  icon: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: PickerOption[]
  /** The trigger's width, which the open list repeats exactly. */
  className?: string
}

/** A tray that opens a short list. Used for the camera and the language. */
export function PickerButton({ icon, label, value, onChange, options, className }: Props) {
  const items = options.map((o) => ({ value: o.value, label: o.label }))
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label} className={className}>
        <span className="text-fg-muted [&_svg]:size-4">{icon}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {o.hint && <span className="text-meta tabular-nums text-fg-muted">{o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
