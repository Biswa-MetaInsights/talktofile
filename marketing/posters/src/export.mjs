// Renders every poster HTML to PDF + PNG with Playwright.
//
//   node marketing/posters/src/export.mjs
//
// Reuses the Playwright install in frontend/node_modules (no extra install needed).
// Output → marketing/posters/export/
//   <name>-social.pdf  1080×1350px page, print-ready (printBackground)
//   <name>-social.png  1080×1350 at 2x (2160×2700)

import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const POSTERS = join(HERE, '..')
const EXPORT = join(POSTERS, 'export')
const require = createRequire(join(HERE, '..', '..', '..', 'frontend', 'package.json'))
const { chromium } = require('playwright')

const NAMES = ['students', 'researchers', 'business', 'legal']
mkdirSync(EXPORT, { recursive: true })

const browser = await chromium.launch()
try {
  for (const name of NAMES) {
    {
      const file = `${name}-social`
      const viewport = { width: 1080, height: 1350 }
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
      await page.goto(pathToFileURL(join(POSTERS, `${file}.html`)).href, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      const fontOk = await page.evaluate(() => document.fonts.check('800 52px Merriweather') && document.fonts.check('italic 800 52px Merriweather'))
      if (!fontOk) throw new Error(`${file}: Merriweather did not load (check the network)`)

      // Layout check: nothing may spill past the page edge, and no text may be clipped.
      const problems = await page.evaluate(() => {
        const out = []
        const pg = document.querySelector('.page').getBoundingClientRect()
        for (const el of document.querySelectorAll('.page *')) {
          if (el.closest('.watermark')) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          const tag = `${el.tagName.toLowerCase()}.${el.className?.baseVal ?? el.className}`
          if (r.bottom > pg.bottom + 0.5 || r.right > pg.right + 0.5 || r.left < pg.left - 0.5)
            out.push(`off-page: ${tag} "${el.textContent.trim().slice(0, 40)}"`)
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible')
            out.push(`clipped: ${tag} "${el.textContent.trim().slice(0, 40)}"`)
        }
        return out
      })
      if (problems.length) console.warn(`  ${file}:\n    ` + [...new Set(problems)].join('\n    '))

      await page.locator('.page').screenshot({ path: join(EXPORT, `${file}.png`) })
      await page.emulateMedia({ media: 'print' })
      await page.pdf({ path: join(EXPORT, `${file}.pdf`), printBackground: true, preferCSSPageSize: true })
      await page.close()
      console.log('exported', file)
    }
  }
} finally {
  await browser.close()
}
