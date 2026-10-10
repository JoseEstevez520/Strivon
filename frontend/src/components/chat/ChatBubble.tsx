import { Maximize2, MessageCircle, Minimize2, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { chatAvailable } from './ask'
import { Chat } from './Chat'
import { useI18n } from '@/lib/i18n'

const corner =
  'grid size-8 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-surface hover:text-fg'

/**
 * The chat as a round button in the corner. Opening lets the button grow into the box, and closing
 * folds it back, so the conversation stays. The box is always laid out at its open size and only
 * the surface around it changes, so growing never reflows what is inside.
 */
export function ChatBubble() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [wide, setWide] = useState(false)
  const [available, setAvailable] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    void chatAvailable().then(setAvailable)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus({ preventScroll: true })
      }
    }
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    root.current?.querySelector('textarea')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const size = {
    '--w': wide ? 'min(60rem, calc(100vw - 2rem))' : 'min(24rem, calc(100vw - 2rem))',
    '--h': wide ? 'calc(100dvh - 8rem)' : 'min(34rem, calc(100dvh - 8rem))',
  } as CSSProperties

  if (!available) return null

  return (
    <div ref={root} style={size} className="fixed right-4 bottom-20 z-40 md:right-6 md:bottom-6">
      <div
        className={`absolute right-0 bottom-0 overflow-hidden transition-[width,height,border-radius,background-color] duration-300 ease-out motion-reduce:transition-none ${
          open ? 'h-(--h) w-(--w) rounded-2xl bg-raised' : 'h-12 w-12 rounded-3xl bg-fg'
        }`}
      >
        <div
          role="dialog"
          aria-label={t.askTitle}
          inert={!open}
          className={`absolute right-0 bottom-0 flex h-(--h) w-(--w) flex-col transition-opacity ease-out motion-reduce:transition-none ${
            open ? 'opacity-100 delay-150 duration-200' : 'pointer-events-none opacity-0 duration-100'
          }`}
        >
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <button type="button" aria-label={wide ? t.smaller : t.larger} onClick={() => setWide((w) => !w)} className={corner}>
              {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className={corner}>
              <X className="size-4" />
            </button>
          </div>
          <Chat />
        </div>
      </div>
      <button
        ref={trigger}
        type="button"
        aria-label={t.askTitle}
        aria-expanded={open}
        inert={open}
        onClick={() => setOpen(true)}
        className={`relative grid size-12 cursor-pointer place-items-center rounded-full text-bg transition-opacity ease-out motion-reduce:transition-none ${
          open ? 'pointer-events-none opacity-0 duration-100' : 'opacity-100 delay-200 duration-200 hover:opacity-85'
        }`}
      >
        <MessageCircle className="size-5" />
      </button>
    </div>
  )
}
