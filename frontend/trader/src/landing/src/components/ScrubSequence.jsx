import { useEffect, useRef } from "react";

export function ScrubSequence({
  frameCount,
  frameUrl,
  className,
  scrollTargetRef,
}) {
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const rafRef    = useRef(null);
  const visible   = useRef(true);
  const lastIndex = useRef(-1);
  const prefersReduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const urls = Array.from({ length: frameCount }, (_, i) => frameUrl(i));

    // Pre-create the Image objects so drawFrame() can index any frame safely,
    // but DON'T set every .src at once — firing all ~120 requests simultaneously
    // floods the origin (tripping rate limits / overwhelming the upstream and
    // causing 503s). Load sequentially through a small concurrency pool instead;
    // sequential order also matches how the scrubber consumes frames.
    const imgs = Array.from({ length: frameCount }, () => new Image());
    if (imgs[0]) imgs[0].fetchPriority = "high";
    imagesRef.current = imgs;

    let cancelled = false;
    let next = 0;
    const CONCURRENCY = Math.min(8, frameCount);

    const loadNext = () => {
      if (cancelled) return;
      const i = next++;
      if (i >= frameCount) return;
      const img = imgs[i];
      const advance = () => {
        img.onload = null;
        img.onerror = null;
        loadNext();
      };
      img.onload = advance;
      img.onerror = advance; // skip missing frames rather than stalling the pool
      img.src = urls[i];
    };

    for (let k = 0; k < CONCURRENCY; k++) loadNext();

    return () => {
      cancelled = true;
    };
  }, [frameCount, frameUrl]);

  const drawImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  const drawFrame = (idx) => {
    const img = imagesRef.current[idx];
    if (img && img.complete && img.naturalWidth > 0) drawImage(img);
  };

  const currentIndex = () => {
    const el = scrollTargetRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const total = el.offsetHeight - window.innerHeight;
    const progress =
      total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    return Math.min(frameCount - 1, Math.floor(progress * (frameCount - 1)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      drawFrame(currentIndex());
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const el = scrollTargetRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollTargetRef]);

  useEffect(() => {
    const tick = () => {
      if (visible.current && !prefersReduced.current) {
        const idx = currentIndex();
        if (idx !== lastIndex.current) {
          drawFrame(idx);
          lastIndex.current = idx;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!prefersReduced.current) return;
    const mid = Math.floor(frameCount / 2);
    const img = imagesRef.current[mid];
    if (img?.complete && img.naturalWidth > 0) drawImage(img);
    else if (img) img.addEventListener("load", () => drawImage(img), { once: true });
  }, [frameCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ transform: "translateZ(0)", willChange: "contents" }}
    />
  );
}
