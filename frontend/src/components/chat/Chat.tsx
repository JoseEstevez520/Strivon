import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Renderer } from '@openuidev/react-lang'
import { library } from './library'
import { ask } from './ask'
import { chatStore, useChat } from './store'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'

/** Three dots that fade in turn while the answer has not started. Only opacity moves. */
function Thinking() {
  const { t } = useI18n()
  return (
    <span role="status" aria-label={t.thinking} className="flex h-6 items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-pulse rounded-full bg-fg-muted" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  )
}

/**
 * A quiet place to ask about the store. Answers are OpenUI Lang drawn with the app's own components
 * (`library.tsx`). It asks a model through `ask.ts`.
 */
export function Chat() {
  const { t, family } = useI18n()
  const { state, gondola } = useStore()
  const { messages, streaming } = useChat()
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // Like the big chats: the thread follows the answer while you are at the bottom, lets go as soon
  // as you scroll up, and a button takes you back down.
  const stick = useRef(true)
  const [away, setAway] = useState(false)

  const toBottom = (smooth: boolean) =>
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })

  useEffect(() => {
    if (stick.current) toBottom(false)
  }, [messages])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stick.current = atBottom
    setAway(!atBottom)
  }

  const context = useMemo(() => {
    const stats = storeStats(state)
    return {
      products: stats.map.map((r) => ({ key: r.product, label: family(r.product) })),
      gondolas: Object.keys(state.images).sort().map((key) => ({ key, label: gondola(key) })),
      worstProducts: stats.map.slice(0, 5).map((r) => family(r.product)),
      worstGondolas: stats.byGondola.slice(0, 5).map((g) => gondola(g.camera)),
      placements: Object.values(state.areas).reduce<Record<string, string[]>>((acc, a) => {
        const list = (acc[a.product_id] ??= [])
        if (!list.includes(a.camera)) list.push(a.camera)
        return acc
      }, {}),
    }
  }, [state, family, gondola])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const question = draft.trim()
    if (!question) return
    const id = chatStore.get().next
    const history = [...messages.map(({ role, text }) => ({ role, text })), { role: 'user' as const, text: question }]
    chatStore.set((s) => ({
      next: s.next + 2,
      streaming: id + 1,
      messages: [...s.messages, { id, role: 'user', text: question }, { id: id + 1, role: 'assistant', text: '' }],
    }))
    setDraft('')
    if (input.current) input.current.style.height = 'auto'
    stick.current = true
    toBottom(true)
    void ask(history, context, t.chatFailed, (text) =>
      chatStore.set((s) => ({ messages: s.messages.map((x) => (x.id === id + 1 ? { ...x, text } : x)) })),
    ).then(() => chatStore.set({ streaming: 0 }))
  }

  return (
    <section aria-label={t.askTitle} className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        // The thread fades out at both ends instead of being cut by an edge.
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 2.75rem, #000 calc(100% - 1.5rem), transparent 100%)' }}
        className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 pt-12 pb-6"
      >
        {messages.length > 0 ? (
          <ol className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} data-source={m.role === 'assistant' ? m.text : undefined} className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-surface px-3 py-2 text-ui' : 'flex flex-col gap-3 px-1'}>
                {m.role === 'user' ? (
                  m.text
                ) : m.text ? (
                  <Renderer response={m.text} library={library} isStreaming={m.id === streaming} />
                ) : (
                  <Thinking />
                )}
              </li>
            ))}
          </ol>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col">
            {t.suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(s)
                    input.current?.focus()
                  }}
                  className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-ui text-fg-secondary transition-colors hover:bg-surface"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {away && (
        <button
          type="button"
          aria-label={t.latest}
          onClick={() => {
            stick.current = true
            toBottom(true)
          }}
          className="absolute bottom-20 left-1/2 z-10 grid size-8 -translate-x-1/2 cursor-pointer place-items-center rounded-full bg-fg text-bg transition-opacity hover:opacity-85"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      <form
        onSubmit={submit}
        className="mx-auto flex w-full max-w-3xl items-end gap-2 p-3 pt-1"
      >
        <div className="flex min-w-0 flex-1 items-end rounded-2xl bg-surface transition-colors has-[textarea:focus]:bg-sunk">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={t.askPlaceholder}
            aria-label={t.askPlaceholder}
            className="scrollbar-subtle max-h-32 min-h-11 w-full resize-none bg-transparent px-4 py-[0.6875rem] text-ui outline-none placeholder:text-fg-muted"
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={t.send}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-fg text-bg transition-[background-color,color,opacity] hover:opacity-85 disabled:pointer-events-none disabled:bg-sunk disabled:text-fg-muted"
        >
          <ArrowUp className="size-5" />
        </button>
      </form>
    </section>
  )
}
