# Install-dialog screenshots

Referenced by `src/app/manifest.ts`. Chrome shows its rich install dialog —
description plus a preview image, instead of the bare name/URL row — only when
the manifest has both a `description` and at least one `screenshot`.

## Rules

- The `sizes` value in the manifest must match the file's real pixel
  dimensions exactly. A mismatch makes Chrome drop the screenshot silently.
- Every screenshot sharing a `form_factor` must share one aspect ratio.
- `wide` drives desktop, `narrow` drives Android. Width and height must each
  be 320–3840px, and the longer side no more than 2.3× the shorter.
- A referenced file that 404s costs you the rich dialog, so add the file and
  the manifest entry together.

## Current

| File | Size | form_factor |
|---|---|---|
| `terminal-wide.png` | 1920×1080 | `wide` |

Capture it from `/trading/terminal` on a maximised 1920×1080 window, with a
chart and at least one open position on screen so the preview shows the
product rather than an empty shell.

To add an Android preview later, drop a 1080×1920 `terminal-narrow.png` here
and add a matching `form_factor: 'narrow'` entry to the manifest.
