import { chromium } from 'playwright-core'
import fs from 'node:fs'
fs.rmSync('rec', { recursive: true, force: true })
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: 'rec', size: { width: 1920, height: 1080 } } })
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:8123/index.html')
await p.addStyleTag({ content: '#dots,#hint{display:none!important}' })
const dwell = [4500, 4500, 4500, 11500, 6500, 17500, 5500, 5000]
for (let i = 0; i < dwell.length; i++) { await p.waitForTimeout(dwell[i]); if (i < dwell.length - 1) await p.keyboard.press('ArrowRight') }
await ctx.close(); await b.close()
console.log(fs.readdirSync('rec'))
