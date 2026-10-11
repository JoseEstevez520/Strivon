import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Development only: serves the challenge photos and the planogram from a folder outside the
 * repo, read-only, so the screen can show real shelves. The data is never part of the build and
 * never committed. Point STRIVON_DATA_DIR at the folder that holds `planogram.json` and
 * `images/<camera>/<timestamp>.jpg`. The model's answers come from `STRIVON_PREDICTIONS`, by default
 * `../outputs/predictions.json` next to the data folder.
 */
export function localData(): Plugin {
  const dir = process.env.STRIVON_DATA_DIR ?? path.resolve(import.meta.dirname, '../data')
  return {
    name: 'strivon-local-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-data', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://local')
        const photo = url.pathname.match(/^\/images\/(\d+)\/(\d+\.jpg)$/)
        try {
          if (url.pathname === '/predictions.json') {
            // What the model says about every area of every photo. Optional: without it the app simulates.
            const file = process.env.STRIVON_PREDICTIONS ?? path.resolve(dir, '../outputs/predictions.json')
            res.setHeader('content-type', 'application/json')
            res.end(fs.readFileSync(file))
          } else if (url.pathname === '/index.json') {
            const planogram = JSON.parse(fs.readFileSync(path.join(dir, 'planogram.json'), 'utf8'))
            const images: Record<string, string[]> = {}
            for (const camera of fs.readdirSync(path.join(dir, 'images'))) {
              images[camera] = fs.readdirSync(path.join(dir, 'images', camera)).filter((f) => /^\d+\.jpg$/.test(f))
            }
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ planogram, images }))
          } else if (photo) {
            res.setHeader('content-type', 'image/jpeg')
            res.setHeader('cache-control', 'max-age=86400')
            res.end(fs.readFileSync(path.join(dir, 'images', photo[1], photo[2])))
          } else {
            next()
          }
        } catch {
          res.statusCode = 404
          res.end('not found')
        }
      })
    },
  }
}

/**
 * Development only: relays the chat to any OpenAI-compatible endpoint, so the key stays on the
 * server. Set LLM_API_KEY, LLM_BASE_URL and LLM_MODEL in `frontend/.env` (git-ignored). Without a
 * key the status route says the chat is off, and the screen does not offer it.
 */
function chatRelay(): Plugin {
  return {
    name: 'strivon-chat-relay',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', import.meta.dirname, '')
      server.middlewares.use('/api/chat', async (req, res, next) => {
        // The chat only shows when there is a key, and this is how the screen finds out.
        if (req.method === 'GET' && req.url === '/status') {
          res.setHeader('content-type', 'application/json')
          return res.end(JSON.stringify({ enabled: Boolean(env.LLM_API_KEY), voice: Boolean(env.OPENAI_API_KEY) }))
        }
        if (req.method !== 'POST' || !env.LLM_API_KEY) return next()
        let body = ''
        for await (const chunk of req) body += chunk
        try {
          const { system, messages } = JSON.parse(body)
          const upstream = await fetch(`${env.LLM_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${env.LLM_API_KEY}` },
            body: JSON.stringify({
              model: env.LLM_MODEL ?? 'gpt-4o-mini',
              stream: true,
              messages: [{ role: 'system', content: system }, ...messages],
            }),
          })
          res.statusCode = upstream.status
          res.setHeader('content-type', 'text/event-stream')
          if (!upstream.body) return res.end()
          for await (const chunk of upstream.body) res.write(chunk)
          res.end()
        } catch {
          res.statusCode = 502
          res.end('relay failed')
        }
      })
    },
  }
}

/**
 * Development only: relays dictation and read-aloud to OpenAI, so the key stays on the server.
 * Set OPENAI_API_KEY in `frontend/.env` (git-ignored). Without it both routes answer 503 and the
 * chat shows no voice buttons. The same caps as the production relay apply: per address, per day,
 * and on the size of what comes in.
 */
function voiceRelay(): Plugin {
  const PER_IP = { max: 20, windowMs: 5 * 60 * 1000 }
  const PER_DAY = 800
  const MAX_AUDIO = 4_000_000
  const MAX_TEXT = 1500
  const seen = new Map<string, number[]>()
  let day = { stamp: new Date().toDateString(), n: 0 }
  const allowed = (ip: string) => {
    const now = Date.now()
    if (day.stamp !== new Date().toDateString()) day = { stamp: new Date().toDateString(), n: 0 }
    if (day.n >= PER_DAY) return false
    const recent = (seen.get(ip) ?? []).filter((t) => now - t < PER_IP.windowMs)
    if (recent.length >= PER_IP.max) return false
    recent.push(now)
    seen.set(ip, recent)
    day.n++
    return true
  }
  return {
    name: 'strivon-voice-relay',
    apply: 'serve',
    configureServer(server) {
      const key = loadEnv('development', import.meta.dirname, '').OPENAI_API_KEY
      server.middlewares.use('/api/voice', async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://local')
        const route = url.pathname
        if (req.method !== 'POST' || (route !== '/transcribe' && route !== '/speak')) return next()
        const fail = (status: number, error: string) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error }))
        }
        if (!key) return fail(503, 'no key')
        if (!allowed(req.socket.remoteAddress ?? '?')) return fail(429, 'too many requests')
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > MAX_AUDIO) return fail(413, 'too large')
          chunks.push(chunk)
        }
        const raw = Buffer.concat(chunks)
        try {
          if (route === '/speak') {
            const text = (JSON.parse(raw.toString('utf8')) as { text?: unknown }).text
            if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return fail(400, 'bad request')
            const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
              body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'alloy', input: text, response_format: 'mp3' }),
            })
            if (!upstream.ok || !upstream.body) return fail(502, 'speech failed')
            res.setHeader('content-type', 'audio/mpeg')
            res.setHeader('cache-control', 'no-store')
            for await (const chunk of upstream.body) res.write(chunk)
            return void res.end()
          }
          const type = String(req.headers['content-type'] ?? '').split(';')[0]
          const language = url.searchParams.get('language') ?? ''
          if (!/^(audio|video)\/(webm|mp4|mpeg|ogg|wav|x-wav|m4a|x-m4a)$/.test(type)) return fail(400, 'bad request')
          if (raw.length < 200 || (language && !/^[a-z]{2}$/.test(language))) return fail(400, 'bad request')
          const form = new FormData()
          form.append('model', 'gpt-4o-mini-transcribe')
          if (language) form.append('language', language)
          const ext = type.split('/')[1].replace('mpeg', 'mp3').replace('x-', '')
          form.append('file', new Blob([raw], { type }), `voice.${ext}`)
          const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { authorization: `Bearer ${key}` },
            body: form,
          })
          if (!upstream.ok) return fail(502, 'transcription failed')
          const text = String(((await upstream.json()) as { text?: unknown }).text ?? '').trim()
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ text }))
        } catch {
          if (!res.headersSent) fail(502, 'voice failed')
          else res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localData(), chatRelay(), voiceRelay()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // The FastAPI server of the pipeline serves the API and the photos.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
