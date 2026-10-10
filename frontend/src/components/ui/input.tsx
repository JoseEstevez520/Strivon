import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

/** A tray: a tone off its surroundings, no line at rest, and it lifts to the raised tone on focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md bg-surface px-3 text-ui text-fg transition-colors outline-none placeholder:text-fg-muted hover:bg-sunk focus-visible:bg-raised disabled:pointer-events-none disabled:opacity-50 aria-invalid:text-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
