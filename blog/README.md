# TalkToFile Blog

A small, SEO-optimized **Astro** static site served at **https://talktofile.ai/blog**.
It's separate from the React app (`../frontend`) and never touches it. Articles are
plain Markdown files — no coding needed to publish.

## How to add a new article (the only thing you'll do regularly)

1. Create a new file in `src/content/posts/`, named after the URL you want.
   The file name becomes the URL. For example:

   `src/content/posts/how-to-chat-with-a-word-document.md`
   → published at `https://talktofile.ai/blog/how-to-chat-with-a-word-document/`

2. Paste this at the very top of the file (this is the "frontmatter"), and fill it in:

   ```markdown
   ---
   title: "How to Chat with a Word Document Using AI"
   description: "A 150-160 character summary Google shows under the title in search results."
   pubDate: 2026-07-08
   keyword: "how to chat with a word document"
   ---
   ```

3. Below the closing `---`, paste the article body (the Markdown you export from
   SEOwriting.ai — choose the **Markdown** export).

4. (Optional but great for SEO) Add an FAQ so Google can show rich results.
   Put this inside the frontmatter, above the closing `---`:

   ```markdown
   faq:
     - q: "Is it free?"
       a: "Yes, the free plan covers 1 file up to 5MB."
     - q: "What files are supported?"
       a: "PDF, Word, Excel, PowerPoint, CSV, text, code, URLs, and YouTube links."
   ```

5. Rebuild and deploy (see below). Done.

To hide a post without deleting it, add `draft: true` to its frontmatter.

## Commands

```bash
npm install       # first time only
npm run dev       # preview locally at http://localhost:4321/blog
npm run build     # build static site into ./dist
npm run preview   # serve the built ./dist locally to double-check
```

## How it's deployed (already wired up)

You don't build this by hand in production — it happens automatically when you deploy
the site with Docker:

- `docker compose build web && docker compose up -d web` (from the repo root) rebuilds
  the Caddy image. That image now builds this blog and copies the result into the web
  server at `/srv/blog`.
- Caddy serves it at `/blog/*` (see the `handle /blog*` block in `../frontend/Caddyfile`).
- Your React app is unchanged and serves everything else.

So the full "publish a new article" flow is:
1. Add the `.md` file (steps above), commit it.
2. On the server: `git pull && docker compose build web && docker compose up -d web`.
3. In Google Search Console, submit the new article URL for indexing.

## SEO built in

Every article automatically gets: a proper `<title>` + meta description, canonical URL,
Open Graph + Twitter cards, JSON-LD structured data (Article, Breadcrumb, and FAQ when
provided), a sitemap at `/blog/sitemap-index.xml`, and `/blog/robots.txt`.

Submit the sitemap once in Google Search Console:
`https://talktofile.ai/blog/sitemap-index.xml`
