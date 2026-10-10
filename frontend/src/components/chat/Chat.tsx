import { ArrowDown, ArrowUp, Mic, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Renderer } from '@openuidev/react-lang'
import { library } from './library'
import { ask } from './ask'
import { chatStore, useChat } from './store'
import { clearDictationError, plainText, speak, startDictation, stopDictation, stopSpeaking, useDictation } from './voice'
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
  const { t, lang, family } = useI18n()
  const { state, gondolaFull: gondola } = useStore()
  const { messages, streaming, voice, open } = useChat()
  const dictation = useDictation()
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // Like the big chats: sending puts your question at the top and the answer grows below it without
  // the view moving, so you read it from its first line. A button takes you down if it runs long.
  const [away, setAway] = useState(false)
  const [viewHeight, setViewHeight] = useState(0)
  const toTop = useRef<number | null>(null)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewHeight(el.clientHeight))
    setViewHeight(el.clientHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The text lands in the field to be read and sent by the person, never sent on its own.
  const dictate = () => {
    if (dictation.state === 'recording') return stopDictation()
    void startDictation(lang, (text) => {
      setDraft((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text))
      input.current?.focus()
    })
  }

  // The field grows with what is in it, typed or dictated.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [draft])

  useEffect(() => {
    if (!open) stopDictation(false)
  }, [open])

  useEffect(() => {
    if (!dictation.error) return
    const timer = setTimeout(clearDictationError, 5000)
    return () => clearTimeout(timer)
  }, [dictation.error])

  const toBottom = () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })

  useEffect(() => {
    const el = scroller.current
    if (toTop.current === null || !el) return
    const question = el.querySelector<HTMLElement>(`[data-id="${toTop.current}"]`)
    toTop.current = null
    if (!question) return
    const top = question.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 24
    el.scrollTo({ top, behavior: 'smooth' })
  }, [messages])

  const onScroll = () => {
    const el = scroller.current
    if (el) setAway(el.scrollHeight - el.scrollTop - el.clientHeight > 80)
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
    stopSpeaking()
    toTop.current = id
    void ask(history, context, t.chatFailed, (text) =>
      chatStore.set((s) => ({ messages: s.messages.map((x) => (x.id === id + 1 ? { ...x, text } : x)) })),
    ).then(() => {
      chatStore.set({ streaming: 0 })
      // Read the finished answer if it is still the latest one and the speaker is on.
      const { speak: on, messages: now } = chatStore.get()
      const answer = now.find((x) => x.id === id + 1)
      const sentences = answer ? plainText(answer.text) : ''
      if (on && sentences && sentences !== t.chatFailed && now[now.length - 1]?.id === id + 1) void speak(sentences)
    })
  }

  return (
    <section aria-label={t.askTitle} className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        // The thread fades out at both ends instead of being cut by an edge.
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 2.75rem, #000 calc(100% - 1.5rem), transparent 100%)' }}
        className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 pt-12 pb-6 sm:px-6"
      >
        {messages.length > 0 ? (
          <ol className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <li
                key={m.id}
                data-id={m.id}
                data-source={m.role === 'assistant' ? m.text : undefined}
                // The last answer is at least a screen tall, so a short one still lets the question reach the top.
                style={i === messages.length - 1 && m.role === 'assistant' ? { minHeight: Math.max(0, viewHeight - 130) } : undefined}
                className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-surface px-3 py-2 text-ui' : 'flex flex-col gap-3 px-1'}
              >
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
          <ul className="flex flex-col">
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
          onClick={toBottom}
          className="absolute bottom-20 left-1/2 z-10 grid size-8 -translate-x-1/2 cursor-pointer place-items-center rounded-full bg-fg text-bg transition-opacity hover:opacity-85"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      {dictation.error && (
        <p role="status" className="px-4 pb-1 text-meta text-fg-secondary sm:px-6">
          {dictation.error === 'denied' ? t.micDenied : dictation.error === 'missing' ? t.micMissing : t.voiceFailed}
        </p>
      )}

      <form
        onSubmit={submit}
        className="flex w-full items-end gap-2 px-4 pt-1 pb-4 sm:px-6"
      >
        <div className="flex min-w-0 flex-1 items-end rounded-2xl bg-surface transition-colors has-[textarea:focus]:bg-sunk">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
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
        {voice && (
          <button
            type="button"
            onClick={dictate}
            disabled={dictation.state === 'transcribing'}
            aria-label={dictation.state === 'recording' ? t.dictateStop : dictation.state === 'transcribing' ? t.transcribing : t.dictate}
            aria-pressed={dictation.state === 'recording'}
            className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors disabled:pointer-events-none ${
              dictation.state === 'recording' ? 'bg-danger/15 text-danger' : 'bg-surface text-fg-secondary hover:bg-sunk hover:text-fg'
            }`}
          >
            {dictation.state === 'recording' ? (
              <Square className="size-4 animate-pulse fill-current" />
            ) : dictation.state === 'transcribing' ? (
              <span className="flex items-center gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1 animate-pulse rounded-full bg-fg-muted" style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </span>
            ) : (
              <Mic className="size-5" />
            )}
          </button>
        )}
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
