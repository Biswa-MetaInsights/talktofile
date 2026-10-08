## Talktofile conventions (read first)

Talktofile is a "chat with your document" app. Clean, minimal, premium; one accent colour. The
components here are the app's real reusable pieces; screens are composed from them plus Tailwind
utility classes.

### Setup

- Wrap the tree in `<ThemeProvider>` (exported from the bundle). `ThemeToggle` throws without it;
  it owns light/dark by toggling the `dark` class on `<html>`. Every `dark:` utility keys off that class.
- Page background is `bg-[#F8FAFC]` (light) / `#0b1120` (dark, applied to `body` by `styles.css`).
- Components animate in with framer-motion. For static mockups set
  `window.Talktofile.MotionGlobalConfig.skipAnimations = true` before rendering.

### Styling idiom: Tailwind utilities (precompiled)

`styles.css` is a **precompiled** Tailwind v3 build: only classes already in it exist. Stick to the
families below; for a one-off value use an inline `style`, not an invented arbitrary class.

| Purpose | Use |
|---|---|
| Accent (the ONLY accent) | `brand-50…900`, anchor `brand-600` = `#E2611B`; e.g. `bg-brand-600`, `text-brand-600`, `bg-brand-50`, `border-brand-300`, `hover:bg-brand-700`. Primary buttons use `bg-[#E2611B] hover:bg-[#E2611B]/90 text-white`. |
| Neutrals | `slate-*` for text/borders/surfaces: `text-slate-700`, `text-slate-500`, `border-slate-200`, `bg-slate-100`; dark pairs `dark:bg-slate-900`, `dark:border-slate-800`, `dark:text-slate-200`. |
| Surfaces | `glass-card` (white card, slate-200 border, shadow-sm, dark-aware) + `rounded-2xl`. Inputs: `input-field`. Buttons: `btn-primary`. Controls use `rounded-xl`. |
| Gradient | avatar/badge gradient `bg-gradient-to-br from-brand-500 to-brand-700`. |
| Type | Merriweather everywhere (`font-sans` = `font-brand`); `font-mono` = JetBrains Mono. Markdown bodies: wrap in `prose-custom`. |
| Motion | `animate-fade-in`, `animate-slide-up`; decorative dot grid `bg-grid`. |

Rules: never use `indigo-*` or any second accent colour. **16px minimum text**: `text-xs` and
`text-sm` are both floored to 1rem, so `text-xs` is not small. Smaller text needs an inline
`fontSize`. Tooltips always use `Tooltip` (dark `#303030` bubble, opens `right` by default); never
hand-roll one.

### Where the truth lives

- `styles.css` → `_ds_bundle.css`: the full compiled class list. Grep it before using a class.
- `components/<group>/<Name>/<Name>.prompt.md` + `.d.ts`: props and examples per component.
- Composition: `SectionComposer` is the bottom chatbox for every section (pass a `proceedButton`,
  optional `pickerRow` such as `ChapterPicker`); `ModeSwitcher` is the section tab row;
  `MessageBubble` renders chat messages (markdown + citation superscripts).

### Example

```jsx
const { ThemeProvider, SummaryCard, ChapterPicker } = window.Talktofile;

<ThemeProvider>
  <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#0b1120] p-6">
    <section className="glass-card rounded-2xl p-5 max-w-xl space-y-4">
      <h2 className="font-brand text-xl font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
      <SummaryCard summary={{ doc_type: 'Report', overview: 'Revenue rose 18% to $4.2M.',
        key_points: ['Churn fell to 2.1%.'], topics: ['finance'] }} />
      <button className="btn-primary">Regenerate summary</button>
    </section>
  </main>
</ThemeProvider>
```
