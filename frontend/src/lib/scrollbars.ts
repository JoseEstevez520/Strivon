/**
 * Lets a `scrollbar-subtle` area show its bar while it scrolls: the attribute goes on at the first
 * scroll event and comes off a moment after the last one. The pointer resting over the content
 * does not show it, only scrolling or going to the bar does. Scroll events do not bubble, so one
 * listener in the capture phase serves every scroller.
 */
export function revealScrollbarsWhileScrolling(): void {
  const timers = new WeakMap<Element, number>()
  document.addEventListener(
    'scroll',
    (e) => {
      const el = e.target
      if (!(el instanceof HTMLElement) || !el.classList.contains('scrollbar-subtle')) return
      el.setAttribute('data-scrolling', '')
      window.clearTimeout(timers.get(el))
      timers.set(el, window.setTimeout(() => el.removeAttribute('data-scrolling'), 900))
    },
    { capture: true, passive: true },
  )
}
