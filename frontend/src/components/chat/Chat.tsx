import { ArrowUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Renderer } from '@openuidev/react-lang'
import { library } from './library'
import { answer } from './offline'
import { Input } from '@/components/ui/input'
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
  const input = useRef<HTMLInputElement>(null)
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
    setMessages((m) => [
      ...m,
      { id, role: 'user', text: question },
      { id: id + 1, role: 'assistant', text: answer(question, products) },
    ])
    setDraft('')
  }

  return (
    <section aria-label={t.askTitle} className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 pt-12 pb-2">
        {messages.length > 0 ? (
          <ol className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-surface px-3 py-2 text-ui' : 'flex flex-col gap-3 px-1'}>
                {m.role === 'user' ? m.text : <Renderer response={m.text} library={library} />}
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

      <form onSubmit={submit} className="relative mx-auto w-full max-w-3xl p-3 pt-1">
        <Input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.askPlaceholder}
          aria-label={t.askPlaceholder}
          className="h-11 rounded-xl pr-12"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={t.send}
          className="absolute top-1/2 right-4.5 grid size-8 -translate-y-[calc(50%-2px)] cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </section>
  )
}
