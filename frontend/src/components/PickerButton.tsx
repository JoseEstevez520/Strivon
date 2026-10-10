import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  icon: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

/** A tray-like picker: a native select dressed as the library's quiet field. */
export function PickerButton({ icon, label, value, onChange, options }: Props) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-md bg-surface py-1.5 pr-8 pl-3 text-label transition-colors hover:bg-raised">
      <span className="text-fg-muted [&_svg]:size-4">{icon}</span>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-fg-muted" />
    </label>
  )
}
