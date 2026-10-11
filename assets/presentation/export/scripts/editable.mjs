import { chromium } from 'playwright-core'
import fs from 'node:fs'
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })
p.on('console', m => console.log('page:', m.text().slice(0, 200)))
await p.goto('http://127.0.0.1:8123/index.html')
await p.addScriptTag({ path: 'node_modules/dom-to-pptx/dist/dom-to-pptx.bundle.js' })
await p.addStyleTag({ content: `
  html,body{overflow:visible!important;height:auto!important}
  #viewport{position:static!important;overflow:visible!important}
  #stage{position:static!important;transform:none!important;height:auto!important;overflow:visible!important}
  .slide{position:relative!important;visibility:visible!important;inset:auto!important;width:1920px;height:1080px;overflow:hidden}
  .in{opacity:1!important;transform:none!important;transition:none!important}
  .shot.in{transform:translate(-50%,0)!important}
  .mk{opacity:1!important}
  *{white-space:nowrap}
  #wipe,#dots,#hint{display:none!important}` })
await p.waitForTimeout(3000)
// the clips become still frames (the real clips go back in afterwards)
const url = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')
await p.evaluate(({ store, chat }) => {
  for (const v of document.querySelectorAll('video')) {
    const img = document.createElement('img')
    if (v.dataset.pause) { img.src = store; img.id = 'clip-store'; img.style.cssText = 'position:absolute;left:930px;top:215px;width:874px;height:629px' }
    else { img.src = chat; img.id = 'clip-chat'; img.className = 'vid'; img.style.cssText = 'top:190px;height:860px' }
    v.replaceWith(img)
  }
  document.querySelector('.count').textContent = '3,399'
}, { store: url('frames/store.png'), chat: url('frames/chat.png') })
await p.waitForTimeout(1000)
const b64 = await p.evaluate(async () => {
  const slides = [...document.querySelectorAll('.slide')]
  const lib = window.domToPptx
  const blob = await lib.exportToPptx(slides, { fileName: 'x.pptx', skipDownload: true, width: 1920 / 96, height: 1080 / 96 })
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s)
})
fs.writeFileSync('editable-raw.pptx', Buffer.from(b64, 'base64'))
await b.close()
console.log('ok', fs.statSync('editable-raw.pptx').size)
