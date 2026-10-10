import { Popover } from '@base-ui/react/popover'
import { Maximize2, MessageSquare, Minimize2, X } from 'lucide-react'
import { useState } from 'react'
import { Chat } from './Chat'
import { useI18n } from '@/lib/i18n'

const corner =
  'grid size-8 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-surface hover:text-fg'

/**
 * The chat as a round button in the corner. It opens a box that fades and scales in from that
 * corner, and closing only hides it, so the conversation stays.
 */
export function ChatBubble() {
  const { t } = useI18n()
  const [wide, setWide] = useState(false)
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t.askTitle}
        className="fixed right-4 bottom-20 z-40 grid size-12 cursor-pointer place-items-center rounded-full bg-fg text-bg transition-opacity hover:opacity-85 md:right-6 md:bottom-6"
      >
        <MessageSquare className="size-5" />
      </Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner side="top" align="end" sideOffset={12} className="z-50">
          <Popover.Popup
            initialFocus={false}
            className={`relative flex origin-(--transform-origin) flex-col rounded-2xl bg-raised text-fg outline-none transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none ${
              wide
                ? 'h-[calc(100dvh-8rem)] w-[min(60rem,calc(100vw-2rem))]'
                : 'h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))]'
            }`}
          >
            <Popover.Title className="sr-only">{t.askTitle}</Popover.Title>
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <button type="button" aria-label={wide ? t.smaller : t.larger} onClick={() => setWide((w) => !w)} className={corner}>
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <Popover.Close aria-label={t.close} className={corner}>
                <X className="size-4" />
              </Popover.Close>
            </div>
            <Chat />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
