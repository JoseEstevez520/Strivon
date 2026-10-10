import { useEffect, useRef } from 'react'

/** Brings a row into view when it opens, for when an area was picked on the photo. */
export function useScrollIntoView<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])
  return ref
}
