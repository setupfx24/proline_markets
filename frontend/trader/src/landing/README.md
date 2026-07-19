# ABP — Cinematic Landing Page

A premium, single-page marketing site with a scroll-scrubbed video hero
(canvas frame sequence, Apple-AirPods-Pro style) and eight editorial sections
beneath. Vite + React 18 + TypeScript + Tailwind v4 + Framer Motion.

## Quickstart

```bash
npm install
npm run dev
```

The hero scrub renders blank until you supply frames — see "Frame pipeline"
below. A banner appears at the bottom of the page if frames are missing.

## Frame pipeline

The hero plays a video by swapping stills on a `<canvas>` tied to scroll
position.

**The frames do NOT live in this app's `public/frames` — that directory is
empty.** They are served by the Next.js app from
`frontend/trader/public/frames` (121 WebP files, ~25 MB). This matters: at
runtime Next.js matches `/frames/*` against its own `public/` and serves the
file directly. Anything it can't match falls through the `rewrites()` fallback
in `next.config.mjs` to this Vite app, which answers unknown paths with the SPA
`index.html` — so a wrong frame name yields HTML (or a 503 under load), never a
clean 404.

Current on-disk naming — 0-indexed, **3**-digit, with a frame-delay suffix:

```
frame_000_delay-0.066s.webp … frame_120_delay-0.066s.webp
```

**Rules:**

- [src/lib/constants.js](src/lib/constants.js) is the single source of truth.
  `frameUrl(i)` builds every URL; `FRAME_COUNT` must equal the number of files
  in `frontend/trader/public/frames`.
- The `<link rel="preload">` in [index.html](index.html) must match
  `FIRST_FRAME_URL`.
- If you re-extract frames, either keep the naming above or update `frameUrl()`
  to match — do not change one without the other.

To regenerate from a source video (`input/` is gitignored):

```bash
ffmpeg -i input/source.mp4 \
  -vf "fps=15,scale='min(1920,iw)':'-2':flags=lanczos" \
  ../../public/frames/frame_%03d.webp

ls ../../public/frames | wc -l   # -> update FRAME_COUNT
```

**No ffmpeg locally?** A WASM alternative using `@ffmpeg/ffmpeg` works in Node
— add a `scripts/extract-frames.mjs` if you need it.

## Customising placeholders

The current build is wired up with a French moving-company example
(`fr-CH`, "ABP"). Swap copy in:

- [index.html](index.html) — `lang`, `<title>`, meta description, frame preload
- [src/components/Navbar.tsx](src/components/Navbar.tsx) — brand, nav items, CTA
- [src/components/Hero.tsx](src/components/Hero.tsx) — headline, sub, CTAs, partners
- [src/components/ServicesBento.tsx](src/components/ServicesBento.tsx) — 6 services
- [src/components/Pourquoi.tsx](src/components/Pourquoi.tsx) — 4 reasons
- [src/components/Process.tsx](src/components/Process.tsx) — 4 steps
- [src/components/Stats.tsx](src/components/Stats.tsx) — 4 stats + bg video URL
- [src/components/Testimonials.tsx](src/components/Testimonials.tsx) — 6+ quotes
- [src/components/Faq.tsx](src/components/Faq.tsx) — Q&A
- [src/components/CtaFooter.tsx](src/components/CtaFooter.tsx) — final CTA + footer links + bg video

Design tokens (palette, fonts, gutter, radius) live at the top of
[src/index.css](src/index.css). Change colours by editing the `--ink`,
`--cream`, `--ochre`, `--terra` HSL triplets — the rest cascades.

## Verification

- `npm run dev` — should start with no errors.
- `npm run build` — TypeScript + Vite production build.
- Lighthouse Performance target: ≥ 85 desktop, LCP < 2.5 s.
- The first frame is preloaded via `<link rel="preload">` in `index.html`.

## Stack

- Vite 5 + React 18 + TypeScript
- Tailwind CSS v4 (with the `@theme` directive in CSS)
- Framer Motion (`motion/react` import path)
- Radix Accordion (shadcn-style wrapper)
- lucide-react icons
- @fontsource/oswald + @fontsource/inter (self-hosted)
