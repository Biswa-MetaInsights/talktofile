// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

// The blog is deployed under https://www.talktofile.ai/blog
// `site` + `base` make every canonical URL, sitemap entry, and internal link
// correctly prefixed with /blog. In production Caddy serves the built files
// (blog/dist) from /srv/blog and maps the /blog/* URL prefix onto them.
export default defineConfig({
  // Non-www apex is the canonical host (Caddy redirects www -> apex).
  site: 'https://talktofile.ai',
  base: '/blog',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  build: {
    // Emit clean directory-style URLs: /blog/my-post/ -> my-post/index.html
    format: 'directory',
  },
})
