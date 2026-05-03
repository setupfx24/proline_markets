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

The hero plays a video by swapping JPGs on a `<canvas>` tied to scroll
position. You provide ONE short source video (5–15 s is ideal) and extract it
to numbered stills.

```bash
# 1. Put the source video at input/source.mp4 (input/ is gitignored).
mkdir -p input public/frames

# 2. Extract frames with ffmpeg (must be installed locally).
ffmpeg -i input/source.mp4 \
  -vf "fps=30,scale='min(1920,iw)':'-2':flags=lanczos" \
  -q:v 3 \
  public/frames/frame_%04d.jpg

# 3. Count the frames and update FRAME_COUNT in src/lib/constants.ts.
ls public/frames | wc -l
```

**Rules:**

- Filenames must be zero-padded 4-digit (`frame_0001.jpg` … `frame_NNNN.jpg`).
- Update `FRAME_COUNT` in [src/lib/constants.ts](src/lib/constants.ts) to match
  the actual number of files. The hero section's height (`250vh`) is tuned for
  ~240 frames; bump to `300vh`–`400vh` for longer sequences.
- `input/` stays gitignored. `public/frames/` ships with the build.
- If your hosting platform has a 25 MB upload limit (e.g. Vercel hobby),
  warn yourself if total frames exceed 20 MB. WebP halves the size:

```bash
# Optional WebP pass (smaller payload, same visual quality)
for f in public/frames/*.jpg; do
  cwebp -q 82 "$f" -o "${f%.jpg}.webp" && rm "$f"
done
# Then set FRAME_EXT to "webp" in src/lib/constants.ts
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
