import { chromium } from 'playwright-core'
import fs from 'node:fs'
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto('http://127.0.0.1:8123/index.html')
await p.addStyleTag({ content: `
  @page{size:1920px 1080px;margin:0}
  html,body{overflow:visible!important;height:auto!important}
  #viewport{position:static!important;overflow:visible!important}
  #stage{position:static!important;transform:none!important;height:auto!important;overflow:visible!important}
  .slide{position:relative!important;visibility:visible!important;inset:auto!important;width:1920px;height:1080px;overflow:hidden;break-after:page}
  .in{opacity:1!important;transform:none!important;transition:none!important}
  .shot.in{transform:translate(-50%,0)!important}
  .mk{opacity:1!important}
  #wipe,#dots,#hint{display:none!important}` })
const url = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')
await p.evaluate(({ store, chat }) => {
  for (const v of document.querySelectorAll('video')) {
    const img = document.createElement('img')
    if (v.dataset.pause) { img.src = store; img.style.cssText = 'position:absolute;left:930px;top:215px;width:874px;height:629px' }
    else { img.src = chat; img.className = 'vid'; img.style.cssText = 'top:190px;height:860px' }
    v.replaceWith(img)
  }
  document.querySelector('.count').textContent = '3,399'
}, { store: url('frames/store.png'), chat: url('frames/chat.png') })
await p.waitForTimeout(2500)
await p.pdf({ path: 'strivon.pdf', width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
await b.close()
