import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localData } from './vite.config.ts'

/**
 * The landing is built on its own: another entry, another output folder, no route of the app.
 * It borrows the app's tokens and a few of its parts, and nothing links from one to the other.
 * Relative paths, so it also works from a sub-path such as GitHub Pages.
 */
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'landing'),
  base: './',
  plugins: [react(), tailwindcss(), localData()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: path.resolve(import.meta.dirname, 'dist-landing'), emptyOutDir: true },
})
