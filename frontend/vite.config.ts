import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import FaqSection from './src/components/FaqSection'
import { PAGE_SEO, SITE_URL, faqJsonLd, type PageSeo } from './src/lib/landingSeo'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Swap the value that follows `prefix` (up to the closing quote). Throws if the
// tag isn't in index.html, so renaming/removing a tag fails the build instead
// of silently shipping the home page's tags on a use-case page.
function setAttr(html: string, prefix: string, value: string): string {
  const start = html.indexOf(prefix)
  if (start === -1) throw new Error(`landing-seo: index.html is missing ${prefix}…"`)
  const from = start + prefix.length
  const end = html.indexOf('"', from)
  return html.slice(0, from) + escapeHtml(value) + html.slice(end)
}

function replaceOnce(html: string, search: string | RegExp, replacement: string): string {
  const found = typeof search === 'string' ? html.includes(search) : search.test(html)
  if (!found) throw new Error(`landing-seo: index.html is missing ${search}`)
  return html.replace(search, () => replacement)
}

// index.html → the use-case page's HTML: its own title/description/canonical/
// social tags, FAQPage JSON-LD, and the FAQ prerendered into #root so it's in
// the HTML before any JS runs. React replaces #root's contents on mount and
// renders the same FaqSection from the same data. The prerendered FAQ sits a
// viewport down, roughly where it lands on the real page, so it doesn't flash at
// the top of the screen while the JS loads.
function renderLandingPage(html: string, slug: string, seo: PageSeo): string {
  const url = `${SITE_URL}/${slug}`
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
  html = setAttr(html, '<meta name="description" content="', seo.description)
  html = setAttr(html, '<meta property="og:title" content="', seo.title)
  html = setAttr(html, '<meta property="og:description" content="', seo.description)
  html = setAttr(html, '<meta property="og:url" content="', url)
  html = setAttr(html, '<link rel="canonical" href="', url)
  html = setAttr(html, '<meta name="twitter:title" content="', seo.title)
  html = setAttr(html, '<meta name="twitter:description" content="', seo.description)
  // `<` escaped so answer text can never close the script tag early.
  const jsonLd = JSON.stringify(faqJsonLd(seo.faqs), null, 2).replace(/</g, '\\u003c')
  html = replaceOnce(html, '</head>', `  <script type="application/ld+json">\n${jsonLd}\n    </script>\n  </head>`)
  const faq = renderToStaticMarkup(createElement(FaqSection, { faqs: seo.faqs }))
  return replaceOnce(html, '<div id="root"></div>', `<div id="root"><div style="padding-top:100vh">${faq}</div></div>`)
}

// '/students', '/students/', '/students?x=1' → the students SEO entry; else null.
function seoForUrl(url: string): [string, PageSeo] | null {
  const slug = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase()
  return slug in PAGE_SEO ? [slug, PAGE_SEO[slug as keyof typeof PAGE_SEO]] : null
}

// Gives each use-case landing page its own static HTML. Build: writes
// dist/<slug>.html next to index.html (Caddy and `vite preview` serve /students
// from students.html). Dev: transforms index.html per request URL.
function landingSeoPlugin(): Plugin {
  return {
    name: 'landing-seo',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.server) return html
      const match = seoForUrl(ctx.originalUrl ?? ctx.path)
      return match ? renderLandingPage(html, ...match) : html
    },
    writeBundle(options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') throw new Error('landing-seo: built index.html not found')
      const html = String(index.source)
      for (const [slug, seo] of Object.entries(PAGE_SEO)) {
        fs.writeFileSync(path.join(options.dir!, `${slug}.html`), renderLandingPage(html, slug, seo))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), landingSeoPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9099',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
