import { useEffect, useRef } from 'react'

/** Brings a row into view when it opens, for when an area was picked on the photo. */
export function useScrollIntoView<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!active) return
    // Wait for the row to finish growing, so the scroll measures its real height.
    const id = setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest' }), 220)
    return () => clearTimeout(id)
  }, [active])
  return ref
}
