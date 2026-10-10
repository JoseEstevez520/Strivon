import { ArrowUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Renderer } from '@openuidev/react-lang'
import { library } from './library'
import { ask } from './ask'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'

/** A question, or an answer as the OpenUI Lang a model writes. */
interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
}

/**
 * A quiet place to ask about the store. Answers are OpenUI Lang drawn with the app's own components
 * (`library.tsx`). Until a model is connected, `offline.ts` writes that text from the question.
 */
export function Chat() {
  const { t, family } = useI18n()
  const { state } = useStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const next = useRef(1)

  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  const products = useMemo(() => storeStats(state).map.map((r) => ({ key: r.product, label: family(r.product) })), [state, family])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const question = draft.trim()
    if (!question) return
    const id = next.current
    next.current += 2
    const history = [...messages.map(({ role, text }) => ({ role, text })), { role: 'user' as const, text: question }]
    setMessages((m) => [...m, { id, role: 'user', text: question }, { id: id + 1, role: 'assistant', text: '' }])
    setDraft('')
    if (input.current) input.current.style.height = 'auto'
    void ask(history, products, (text) => setMessages((m) => m.map((x) => (x.id === id + 1 ? { ...x, text } : x))))
  }

  return (
    <section aria-label={t.askTitle} className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 pt-12 pb-2">
        {messages.length > 0 ? (
          <ol className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-surface px-3 py-2 text-ui' : 'flex flex-col gap-3 px-1'}>
                {m.role === 'user' ? m.text : <Renderer response={m.text} library={library} isStreaming={!m.text} />}
              </li>
            ))}
            <div ref={end} />
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
