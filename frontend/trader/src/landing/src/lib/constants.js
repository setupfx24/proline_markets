// Hero scroll-scrub frame sequence.
//
// The frames are served by the Next.js app from `frontend/trader/public/frames`
// (NOT this Vite app's `public/frames`, which is empty). Next.js matches
// /frames/* directly, so these never fall through the rewrite to the landing
// dev server. Keep the naming below in sync with the files on disk — they come
// out of the extractor as 0-indexed, 3-digit, with the frame-delay suffix:
//   frame_000_delay-0.066s.webp … frame_120_delay-0.066s.webp
export const FRAMES_PATH = "/frames";
export const FRAME_COUNT = 121;
export const FRAME_EXT   = "webp";

const pad3 = (n) => String(n).padStart(3, "0");

/** URL for the i-th frame (i is 0-based). */
export const frameUrl = (i) =>
  `${FRAMES_PATH}/frame_${pad3(i)}_delay-0.066s.${FRAME_EXT}`;

/** Preloaded in index.html — keep the two in sync. */
export const FIRST_FRAME_URL = frameUrl(0);
