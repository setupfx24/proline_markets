// Deliberately empty. The landing uses Tailwind v4 through @tailwindcss/vite,
// which needs no PostCSS plugins. Without a config HERE, Vite walks up the tree
// and picks up frontend/trader/postcss.config.js — Tailwind v3 — which then
// rejects this stylesheet ("`@layer base` is used but no matching
// `@tailwind base` directive"), so the landing could not be built from inside
// the monorepo. The Docker build never hit it only because its context is this
// folder alone.
export default { plugins: {} };
