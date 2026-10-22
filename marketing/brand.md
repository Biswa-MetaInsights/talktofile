# Talktofile brand tokens

Extracted read-only from the app code. Nothing in the app was changed.
Every value below cites the file it came from. Values marked **(guess)** are not defined
in code and were inferred for print use.

Sources:

- `frontend/tailwind.config.js` — colour scale, fonts, font-size floor, glow keyframe
- `frontend/src/index.css` — body colours, `.btn-primary`, `.input-field`, `.glass-card`, `.bg-grid`
- `frontend/index.html` — Google Fonts links
- `frontend/src/components/Landing.tsx`, `Navbar.tsx`, `MessageBubble.tsx`, `CitationMarker.tsx`, `ChatWindow.tsx`, `ModeSwitcher.tsx` — component styling
- `blog/src/styles/global.css` — the only place brand colours exist as CSS variables
- `CLAUDE.md` → "Design / Brand" — brand rules
- `talktofile_logo/svg/*`, `frontend/src/assets/*` — logo files

There are **no CSS custom properties in the app**. Tokens live in the Tailwind config and as
hard-coded hex values in class names (for example `bg-[#E2611B]`, `text-[#303030]`).

---

## Name

- Wordmark and product name in code: **Talktofile** (only the first T is capital). `landingSeo.ts`
  says "Brand is always 'Talktofile'". The domain is **talktofile.ai**.
- The blog header comment spells it "TalkToFile". The posters follow the app and use **Talktofile**.

## Colours

### Accent: pumpkin orange (the only accent colour)

From `tailwind.config.js` → `colors.brand`. `CLAUDE.md`: "single accent for the whole app".

| Token | Hex | Use in the app |
|---|---|---|
| brand-50  | `#fdf4ee` | citation chip background, warning panels |
| brand-100 | `#fbe6d6` | citation highlight `<mark>`, panel borders |
| brand-200 | `#f6cbab` | user-bubble timestamp text, panel borders |
| brand-300 | `#efa878` | dark-mode accent text |
| brand-400 | `#e9854a` | blockquote rule, status dot |
| brand-500 | `#e56f2d` | gradient start (avatars), small icons |
| **brand-600** | **`#E2611B`** | **Primary accent.** Buttons, active tabs, payoff text, icons, footer background |
| brand-700 | `#bc4d14` | gradient end (user bubble, avatars), hover |
| brand-800 | `#963d14` | citation `<mark>` text |
| brand-900 | `#793314` | (defined, not seen in use) |

Logo-only oranges (from the SVGs, not in the Tailwind scale):

| Hex | Where |
|---|---|
| `#C2410C` | Chat-bubble fill in `mark-color.svg` / `lockup-color.svg` (Tailwind `orange-700`) |
| `#E8763F` | Chat-bubble fill in `mark-white-accent.svg` (dark-surface logo) |

### Neutrals (Tailwind `slate`)

| Role | Hex | Source |
|---|---|---|
| Page background | `#F8FAFC` (slate-50) | `index.css` body, Navbar `bg-[#F8FAFC]` |
| Card surface | `#FFFFFF` | `.glass-card`, chat bubbles, feature cards |
| Headline ink | `#303030` | Landing `h1`/`h2` `text-[#303030]`, Tooltip bubble, drop-zone border |
| Logo ink | `#0e1413` | logo SVG strokes, blog `--ink` |
| Body text | `#0f172a` (slate-900) | `index.css` body |
| Secondary text | `#475569` (slate-600) / `#64748b` (slate-500) | card bodies, italic sublines |
| Muted text | `#94a3b8` (slate-400) | timestamps, placeholders |
| Borders | `#e2e8f0` (slate-200) | cards, inputs, chat header |
| Subtle fill | `#f1f5f9` (slate-100) | progress track, citation footer rule |

### Dark theme

| Role | Hex |
|---|---|
| Background | `#0b1120` (`html.dark body`) |
| Text | `#e2e8f0` (slate-200) |
| Surfaces | slate-900 `#0f172a`, slate-800 `#1e293b` |

### Not part of the brand

`obsidian` (indigo) and `cyan` palettes exist in `tailwind.config.js`, but `CLAUDE.md` says they
have 0 uses and **must not be used**. "There is no indigo in this app."

## Typography

Loaded from Google Fonts in `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

| Role | Family | Weight / style | Other |
|---|---|---|---|
| Everything (body, UI, headings) | **Merriweather**, Georgia, serif | 400 body, 500 medium, 600 semibold | `font-sans`, `font-brand` and `font-merriweather` all map to it |
| Hero headline (`h1`) | Merriweather | **800** (`font-extrabold`) | `tracking-[-0.03em]`, `leading-[1.1]`, 56px at desktop, colour `#303030` |
| Hero payoff phrase | Merriweather | 800 **italic** | colour `#E2611B`, never wraps |
| Section heading (`h2`) | Merriweather | 700 | `tracking-[-0.02em]`, 48px at desktop; ends in an italic orange phrase |
| Subhead / trust row | Merriweather | 400 | `tracking-[-0.03em]`, 24px at desktop, `#303030` |
| Wordmark "Talktofile" | Merriweather | 700 **italic** | 34px, `tracking-[-0.02em]`, `#E2611B` on light surfaces |
| Eyebrow label | Merriweather | 600 | uppercase, `tracking-[0.25em]`, orange, with 32px orange hairlines on both sides |
| Code | JetBrains Mono | 400/500 | `font-mono` |

- **16px minimum font size** across the site (`text-xs` and `text-sm` are floored to 1rem).
- Inter and Plus Jakarta Sans are also loaded, but `CLAUDE.md` says Inter is used only inside slide
  previews and Plus Jakarta Sans is unused. The posters do not use them.

## Shape

| Token | Value | Used for |
|---|---|---|
| `rounded-lg` | 8px | avatars, small chips, tooltips |
| `rounded-xl` | 12px | buttons (`.btn-primary`), inputs, source rows, icon chips |
| `rounded-2xl` | 16px | **cards** (the default card corner), chat bubbles, upload card |
| `rounded-3xl` | 24px | the mode-tab container |
| `rounded-full` | pill | active mode tab, send button, step numbers |
| Chat bubble tail | one corner 6px (`rounded-br-md` user / `rounded-bl-md` assistant) | |

## Shadows

The app uses Tailwind's default shadows, sometimes tinted:

| Token | Value | Used for |
|---|---|---|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | cards, buttons, bubbles |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | card hover |
| `shadow-lg shadow-slate-200/60` | `0 10px 15px -3px rgb(226 232 240 / .6), 0 4px 6px -4px rgb(226 232 240 / .6)` | the hero chat box |
| `shadow-xl shadow-slate-900/10` | `0 20px 25px -5px rgb(15 23 42 / .1), 0 8px 10px -6px rgb(15 23 42 / .1)` | citation popover |
| glow keyframe | `0 0 30px rgba(226,97,27,.8), 0 0 60px rgba(226,97,27,.3)` | defined animation |

## Gradients and textures

| Name | Value | Used for |
|---|---|---|
| User chat bubble | `linear-gradient(to bottom right, #E2611B, #bc4d14)` | `MessageBubble` (brand-600 → brand-700) |
| Avatar tile | `linear-gradient(to bottom right, #e56f2d, #bc4d14)` | "T" assistant avatar (brand-500 → brand-700) |
| Progress bar | `linear-gradient(to right, rgb(226 97 27 / .7), #E2611B)` | upload progress |
| Dot grid `.bg-grid` | `radial-gradient(circle, rgba(226,97,27,.08) 1px, transparent 1px)` at `24px 24px` | landing page background |

## Buttons and controls

| Component | Style |
|---|---|
| Primary button (`.btn-primary`) | `#E2611B` background, white text, 500 weight, 12px radius, `py-2.5 px-5`, `shadow-sm`; hover 90% opacity |
| Send button | 40px circle, `#E2611B`, white `ArrowUp` icon |
| Active mode tab | `#E2611B` pill with white text and icon |
| Inactive mode tab | slate-700 text, icon 18px, stroke 2.25 |
| Input | white, 1px slate-200 border, 12px radius; focus border `#E2611B` plus a 2px ring at 20% |
| Icon chip | 40px, 12px radius, `#E2611B` at 10% fill, 1px `#E2611B` at 20% border, 20px orange icon |
| Citation marker | superscript number, brand-50 fill, brand-600 bold text, 6px radius |
| Tooltip | `#303030` bubble, white text, 8px radius |

## Chat UI (what the poster mockups copy)

- **Chat header** (`ChatWindow.tsx`): white bar, slate-200 bottom border, 32px brand-50 icon chip
  with a brand-500 mode icon, filename in slate-800 medium.
- **Chat background**: `bg-brand-50/25` (brand-50 at 25%).
- **User bubble**: brand-600 → brand-700 gradient, white text, `rounded-2xl rounded-br-md`, `shadow-sm`.
- **Assistant bubble**: white, slate-200 border, `rounded-2xl rounded-bl-md`, slate-700 text,
  `strong` in slate-900 semibold, with superscript citation markers.
- **Avatars**: 32px `rounded-lg` gradient tile with a white "T" (assistant) or the user's initial.
- **Citation popover** (`CitationMarker.tsx`): white card, 12px radius, `shadow-xl`, header with the
  filename in uppercase brand-600, location as "¶ 14", and "93% match" in brand-500. The matched
  phrase is highlighted with a brand-100 `<mark>` and brand-800 text.
- **Composer**: slate-50 field, slate-200 border, 16px radius, orange round send button.

## Icons

- Library: **lucide-react 0.468.0**. Stroke icons, 24-unit grid, default stroke 2 (the landing hero
  uses 2.25).
- Mode icons (`ModeSwitcher.tsx` → `MODE_ICONS`): Chat `MessageSquare`, Summary `FileText`,
  Flashcards `Layers`, Slides `Presentation`, Translate `Languages`, Podcast `Mic`, Charts `BarChart3`.
- Use-case icons (`landingVariants.ts`): Students `GraduationCap`, Research `Microscope`,
  Legal `Scale`, Business `LineChart`.
- Trust icons: `Lock` (Nothing stored), `Zap` (No sign-up), `CheckCircle` (Answers only from your
  file), `Smartphone` (Revise on the go).
- There are **no illustrations** on the landing pages. The only image asset there is the logo.

## Logo

| File | Use |
|---|---|
| `talktofile_logo/svg/lockup-color.svg` | **Full lockup** (mark + "Talktofile"), dark ink + terracotta bubble. For light backgrounds. |
| `talktofile_logo/svg/lockup-white.svg` / `lockup-black.svg` | One-colour lockups |
| `talktofile_logo/svg/mark-color.svg` (= `frontend/src/assets/mark-color.svg`) | Mark only, light surfaces (Navbar) |
| `talktofile_logo/svg/mark-white.svg` | All-white mark, orange surfaces (footer) |
| `talktofile_logo/svg/mark-white-accent.svg` | White mark with `#E8763F` bubble, dark surfaces (dark-mode Navbar) |
| `talktofile_logo/svg/app-icon.svg`, `app-icon-dark.svg` | Square tiles, currently unused |

**How the app draws the logo** (Navbar): `mark-color.svg` at 56px next to the text "Talktofile" in
Merriweather 700 italic 34px, `tracking-[-0.02em]`, colour **`#E2611B`**. The wordmark has a
`-ml-3` margin because the mark has about 23% empty space on each side.

Note the difference: `lockup-color.svg` draws the wordmark in `#0e1413` ink, while the live Navbar
draws it in `#E2611B` orange. **The posters copy the live Navbar** (`mark-color.svg` + orange
italic text), because that is what visitors see.

Brand rules from `CLAUDE.md`:

- Never put `mark-white` on a light surface, or `mark-color` on a dark one.
- Never use indigo. Don't add colours or fonts.
- Clean, minimal, premium.

---

## Values I had to guess (print use only)

| Item | Decision | Why |
|---|---|---|
| Poster type sizes | Headline 64px (A4) / 84px (social); body 20–24px | The app's sizes are for screens. Kept the app's weights, tracking and leading. |
| Small orange text on white | brand-700 `#bc4d14` | brand-600 on white is 3.5:1, too low for small text. brand-700 is 5.0:1. brand-600 is still used for large text, icons and fills. |
| One accent for all posters | brand-600 `#E2611B` on every poster; the audience tag and a faint large use-case icon tell them apart | The brand has a single accent colour. |
| CTA band text on brand-600 | Only large text (19px bold or bigger); the legal disclaimer sits on the light surface in slate-500 | White on `#E2611B` is 3.5:1, which passes only for large text. |
| QR code | `#303030` modules on a white 12px-radius tile, error correction M, pre-generated SVGs in `posters/src/qr/` | No QR style exists in the app. |
