# design-sync notes: Talktofile frontend

Synced to Claude Design project "Talktofile Design System"
(`projectId` in `config.json`). Run everything from `frontend/` (the config home).

## How this repo is wired

- **It's an app, not a library.** No `dist/` library build and no `.d.ts`. The bundle entry is the
  curated barrel `.design-sync/entry.ts`. The converter's synth-from-`src/` fallback would
  re-export `main.tsx` (mounts the app) plus Supabase/PostHog setup, so never drop `cfg.entry`.
- **Scope = reusable primitives only** (15, user-chosen on 2026-10-08). App screens (ChatWindow,
  Landing, SlidesView, AuthModal, Navbar, UploadZone, WorkspaceHeader, DocumentPanel, the modals)
  are excluded because they need auth/API/WebSockets. To add one: export it in `entry.ts`, then add
  `componentSrcMap`, `dtsPropsFor` and `docsMap` (group) entries in `config.json`, then author
  `previews/<Name>.tsx`.
- **Props are hand-written in `cfg.dtsPropsFor`.** Components declare a local, unexported
  `interface Props`, which the extractor can't see. The bodies inline the shared types (`Source`,
  `Message`, `AppMode`, ... from `src/types`).
- **Groups** come from `docsMap` → stub files `.design-sync/groups/{chat,workspace,primitives,marketing}.md`.
- **CSS** is a dedicated Tailwind build (`cfg.buildCmd`): `.design-sync/tailwind.config.js`
  extends the app's `tailwind.config.js` and safelists the brand/slate families + `glass-card`,
  `input-field`, `btn-primary`, `prose-custom`. The input `.design-sync/styles.input.css` imports
  Google Fonts (Merriweather, JetBrains Mono, Inter) and `src/index.css`. Output goes to
  `.design-sync/.cache/tailwind.css` (= `cfg.cssEntry`). **Re-run `buildCmd` before the converter**
  whenever previews or app classes change, or new classes won't be in the stylesheet.
- Fonts load at runtime from Google Fonts → `runtimeFontPrefixes`; nothing ships in `fonts/`.
- Provider: `ThemeProvider` (`ThemeToggle` → `useTheme` throws without it).

## Gotchas found during the first sync

- **framer-motion entrance animations stay at `opacity: 0` in `package-capture.mjs`** (they play
  fine in a normal browser and in validate). Every preview using a framer component sets
  `MotionGlobalConfig.skipAnimations = true` at module top. `MotionGlobalConfig` is exported from
  `entry.ts` for this.
- `ConfirmDialog` / `CitationPanel` are `position: fixed`. Their previews wrap them in a
  `transform: translateZ(0)` container with an explicit height so the overlay is contained in the
  card. `CitationPanel` uses a 1100px viewport so its `lg:` in-flow layout renders (no backdrop).
- `Tooltip` preview pins the hover bubble open with a scoped `<style>` (`.pin-open [role=tooltip]`).
  That is preview-only, not usage.
- `MicButton` is transparent until hover; the preview shows it inside an input row.
- `CitationMarker`'s popover is hover/click state and can't render statically, so the card shows
  inline markers only.
- Windows: `package-build.mjs` fails `EPERM` rm-ing `ds-bundle/` if any shell's cwd is inside it or a
  file server is serving it. `cd` out and stop `http-serve.mjs` first.
- The user's `npm run dev` (Vite) may be running; it doesn't interfere.

## Known render warns

- none outstanding at the end of the first sync.

## Re-sync risks

- `dtsPropsFor` bodies are **copies** of each component's `Props` + `src/types`. Any prop change in
  a synced component must be mirrored there, or the design agent codes against a stale API.
- The FAQ preview inlines 4 FAQs copied from `src/lib/landingSeo.ts` (students page). Harmless if
  stale, but not live.
- `conventions.md` names classes that must exist in the compiled CSS (verified 2026-10-08). If
  `tailwind.config.js` colours/fonts change, re-validate it against `ds-bundle/_ds_bundle.css`.
- Toolchain at first sync: Node 24.16, Tailwind 3.4, framer-motion 11.18, playwright 1.61.1
  (chromium-1228, already cached). The repo's `node_modules` was reused as installed (no `npm ci`),
  so a fresh clone needs `npm ci` in `frontend/` first.
