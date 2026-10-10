import { useEffect, useState } from 'react'

/** True once the page has moved, for what only shows then, such as the line under the header. */
export function useScrolled(offset = 1): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY >= offset)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return scrolled
}
