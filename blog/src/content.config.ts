import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

// Every article is one Markdown file in src/content/posts/.
// The frontmatter (the bit at the top between --- lines) must match this schema.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      // Shown as the <h1>, the browser tab title, and the SEO <title>.
      title: z.string(),
      // The meta description Google shows under the title (aim 150-160 chars).
      description: z.string(),
      // Publish date, e.g. 2026-07-06
      pubDate: z.coerce.date(),
      // Optional: last-updated date. Set this when you edit an old post.
      updatedDate: z.coerce.date().optional(),
      // The SEO keyword this article targets (for your own reference).
      keyword: z.string().optional(),
      // Set to true to keep a post hidden (won't build or show in the list).
      draft: z.boolean().default(false),
      // Optional social-share / hero image (a file in src/assets or a URL).
      heroImage: z.string().optional(),
      // Optional: an FAQ list to emit as Google FAQ rich-result data.
      // Example in a post's frontmatter:
      //   faq:
      //     - q: "Is it free?"
      //       a: "Yes, the free plan covers 1 file up to 5MB."
      faq: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .optional(),
    }),
})

export const collections = { posts }
