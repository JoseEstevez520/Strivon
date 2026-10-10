import { useCallback, useEffect, useState } from 'react'

/**
 * The area open on a page. Escape closes it. From the list the user is already looking at the
 * row, so only an area picked on the photo is brought into view, and only once.
 */
export function useSelection(initial: string | null = null) {
  const [selected, setSelected] = useState<string | null>(initial)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = useCallback((areaId: string | null, from: 'list' | 'photo' = 'list') => {
    setSelected(areaId)
    if (areaId && from === 'photo') {
      setTimeout(
        () =>
          (document.querySelector(`[data-area="${areaId}"]`) ?? document.querySelector('[data-selected="true"]'))?.scrollIntoView({
            block: 'nearest',
          }),
        220,
      )
    }
  }, [])

  return [selected, select] as const
}
