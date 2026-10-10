import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Development only: serves the challenge photos and the planogram from a folder outside the
 * repo, read-only, so the screen can show real shelves. The data is never part of the build and
 * never committed. Point STRIVON_DATA_DIR at the folder that holds `planogram.json` and
 * `images/<camera>/<timestamp>.jpg`.
 */
function localData(): Plugin {
  const dir = process.env.STRIVON_DATA_DIR ?? path.resolve(import.meta.dirname, '../data')
  return {
    name: 'strivon-local-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-data', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://local')
        const photo = url.pathname.match(/^\/images\/(\d+)\/(\d+\.jpg)$/)
        try {
          if (url.pathname === '/index.json') {
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
 * key it answers 503 and the chat falls back to its offline answers.
 */
function chatRelay(): Plugin {
  return {
    name: 'strivon-chat-relay',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', import.meta.dirname, '')
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (!env.LLM_API_KEY) {
          res.statusCode = 503
          return res.end('no key')
        }
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

export default defineConfig({
  plugins: [react(), tailwindcss(), localData(), chatRelay()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // The FastAPI server of the pipeline serves the API and the photos.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
