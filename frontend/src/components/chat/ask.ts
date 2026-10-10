import { answer } from './offline'
import { systemPromptFor } from './library'

export interface Turn {
  role: 'user' | 'assistant'
  text: string
}

/** The model sometimes wraps its answer in a code fence; the renderer wants only the language. */
const bare = (text: string) => text.replace(/^```[a-z-]*\n?/i, '').replace(/```\s*$/, '')

/**
 * Asks the model through `/api/chat`, which relays to an OpenAI-compatible endpoint, and calls
 * `onText` with the answer so far as it streams in. If there is no model (no key, no network) it
 * falls back to the offline answer, so the chat always answers.
 */
export async function ask(
  history: Turn[],
  products: { key: string; label: string }[],
  onText: (text: string) => void,
): Promise<void> {
  const question = history[history.length - 1].text
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system: systemPromptFor(products),
        messages: history.map((m) => ({ role: m.role, content: m.text })),
      }),
    })
    if (!res.ok || !res.body) throw new Error(String(res.status))
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let pending = ''
    let text = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      pending += value
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:') || line.includes('[DONE]')) continue
        try {
          text += JSON.parse(line.slice(5)).choices?.[0]?.delta?.content ?? ''
          onText(bare(text))
        } catch {
          // A partial line: the next chunk completes it.
        }
      }
    }
    if (!text.trim()) throw new Error('empty')
  } catch {
    onText(answer(question, products))
  }
}
