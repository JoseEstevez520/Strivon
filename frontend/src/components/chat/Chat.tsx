import { ArrowUp, MessageSquare } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnswerBlockView, type AnswerBlock } from './answers'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'

interface Message {
  id: number
  role: 'user' | 'assistant'
  blocks: AnswerBlock[]
}

/**
 * A quiet place to ask about the day. The assistant is not connected yet, so every question gets
 * the same plain answer. The thread already holds answers as parts of the app's own components, so
 * connecting one is a matter of returning those parts.
 */
export function Chat() {
  const { t } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const next = useRef(1)

  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const question = draft.trim()
    if (!question) return
    const id = next.current
    next.current += 2
    setMessages((m) => [
      ...m,
      { id, role: 'user', blocks: [{ type: 'text', text: question }] },
      { id: id + 1, role: 'assistant', blocks: [{ type: 'text', text: t.notConnected }] },
    ])
    setDraft('')
  }

  return (
    <section aria-label={t.askTitle}>
      <h2 className="flex h-9 items-center gap-2 px-1 text-label text-fg-muted">
        <MessageSquare className="size-4" />
        {t.askTitle}
      </h2>

      {messages.length > 0 && (
        <ol className="mb-3 flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-surface px-3 py-2 text-ui' : 'flex flex-col gap-3 px-1'}>
              {m.blocks.map((b, i) => (
                <AnswerBlockView key={i} block={b} />
              ))}
            </li>
          ))}
          <div ref={end} />
        </ol>
      )}

      <form onSubmit={submit} className="relative">
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
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>

      {messages.length === 0 && (
        <ul className="mt-2 flex flex-col">
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
    </section>
  )
}
