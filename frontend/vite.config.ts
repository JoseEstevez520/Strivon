import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Development only: serves the challenge photos and the planogram from a folder outside the
 * repo, read-only, so the screen can show real shelves. The data is never part of the build and
 * never committed. Point STRIVON_DATA_DIR at the folder that holds `planogram.json` and
 * `images/<camera>/<timestamp>.jpg`.
 */
function localData(): Plugin {
  const dir = process.env.STRIVON_DATA_DIR ?? path.resolve(import.meta.dirname, '../../Strivon/data')
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

export default defineConfig({
  plugins: [react(), tailwindcss(), localData()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // The FastAPI server of the pipeline serves the API and the photos.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
