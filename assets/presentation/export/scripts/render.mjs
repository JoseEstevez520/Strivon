import { chromium } from 'playwright-core'
import fs from 'node:fs'
const out = process.argv[2], scale = Number(process.argv[3] ?? 2)
fs.mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale })
await p.goto('http://127.0.0.1:8123/index.html#1')
await p.addStyleTag({ content: '#dots,#hint{display:none!important}' })
const n = await p.locator('section.slide').count()
for (let i = 0; i < n; i++) {
  await p.goto(`http://127.0.0.1:8123/index.html#${i + 1}`); await p.reload()
  await p.addStyleTag({ content: '#dots,#hint{display:none!important}' })
  await p.waitForTimeout(i === 3 ? 10000 : 4500)
  if (i === 5) { await p.evaluate(async () => { const v = document.querySelector('.slide.active video'); v.pause(); v.currentTime = 8.3; await new Promise(r => v.addEventListener('seeked', r, { once: true })) }); await p.waitForTimeout(800) }
  await p.screenshot({ path: `${out}/slide-${String(i + 1).padStart(2, '0')}.png` })
  console.log('slide', i + 1)
}
await b.close()
