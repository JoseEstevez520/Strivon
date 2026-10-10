import { useSyncExternalStore } from 'react'

/** What a person reads in an answer: the sentences of its `Text` and `Callout` parts, in order. */
export function plainText(source: string): string {
  const parts: string[] = []
  for (const m of source.matchAll(/\b(?:Text|Callout)\(\s*("(?:[^"\\]|\\.)*")/g)) {
    try {
      const sentence = String(JSON.parse(m[1])).trim()
      if (sentence) parts.push(sentence)
    } catch {
      // A string cut off mid-stream: the finished answer has it whole.
    }
  }
  return parts.join(' ')
}

// ---- Reading aloud ----------------------------------------------------------------------------

let player: HTMLAudioElement | null = null
let playing = 0

/** Stops whatever is being read, and any request still on its way. */
export function stopSpeaking() {
  playing++
  if (player) {
    player.pause()
    URL.revokeObjectURL(player.src)
    player = null
  }
}

/** Reads `text` through `/api/voice/speak`. A newer call, or `stopSpeaking`, cancels this one. */
export async function speak(text: string): Promise<void> {
  stopSpeaking()
  const turn = playing
  try {
    const res = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 1500) }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    if (turn !== playing) return
    const audio = new Audio(URL.createObjectURL(blob))
    player = audio
    audio.onended = () => {
      if (player === audio) stopSpeaking()
    }
    await audio.play()
  } catch {
    // Reading aloud is a courtesy: if it fails the answer is still on screen.
  }
}

// ---- Dictation --------------------------------------------------------------------------------

export type DictationState = 'idle' | 'recording' | 'transcribing'
export type DictationError = 'denied' | 'missing' | 'failed' | null

let dictation: { state: DictationState; error: DictationError } = { state: 'idle', error: null }
const listeners = new Set<() => void>()
const setDictation = (patch: Partial<typeof dictation>) => {
  dictation = { ...dictation, ...patch }
  listeners.forEach((l) => l())
}

let recorder: MediaRecorder | null = null
let discard = false

export const useDictation = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => dictation,
  )

/** True while the microphone is open. */
export const isRecording = () => dictation.state === 'recording'

export const clearDictationError = () => dictation.error && setDictation({ error: null })

/** Closes the microphone. With `keep` the recording is transcribed, without it it is thrown away. */
export function stopDictation(keep = true) {
  discard = !keep
  if (recorder && recorder.state !== 'inactive') recorder.stop()
}

/** Records until `stopDictation`, then sends the audio to `/api/voice/transcribe` and hands the text to `onText`. */
export async function startDictation(language: string, onText: (text: string) => void) {
  if (dictation.state !== 'idle') return
  stopSpeaking()
  setDictation({ error: null })
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
    return setDictation({ error: denied || !navigator.mediaDevices ? 'denied' : 'missing' })
  }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m))
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  discard = false
  recorder = rec
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop())
    recorder = null
    if (discard || chunks.length === 0) return setDictation({ state: 'idle' })
    setDictation({ state: 'transcribing' })
    const type = rec.mimeType || 'audio/webm'
    try {
      const res = await fetch(`/api/voice/transcribe?language=${encodeURIComponent(language)}`, {
        method: 'POST',
        headers: { 'content-type': type },
        body: new Blob(chunks, { type }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const text = String((await res.json()).text ?? '').trim()
      setDictation({ state: 'idle', error: text ? null : 'failed' })
      if (text) onText(text)
    } catch {
      setDictation({ state: 'idle', error: 'failed' })
    }
  }
  rec.start()
  setDictation({ state: 'recording' })
}
