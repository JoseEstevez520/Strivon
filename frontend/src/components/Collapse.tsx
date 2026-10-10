import type { ReactNode } from 'react'

/**
 * Opens and closes a block by animating its height with a grid row, so no height is measured.
 * Closing is a little faster than opening. Closed content is inert, so the keyboard skips it.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100 duration-200' : 'grid-rows-[0fr] opacity-0 duration-150'
      }`}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  )
}
