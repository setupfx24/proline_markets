import { useEffect, useRef } from "react";

const pad4 = (n) => String(n).padStart(4, "0");

export function ScrubSequence({
  framesPath,
  frameCount,
  ext = "jpg",
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
    const imgs = [];
    const urls = Array.from(
      { length: frameCount },
      (_, i) => `${framesPath}/frame_${pad4(i + 1)}.${ext}`
    );

    const first = new Image();
    first.src = urls[0];
    first.fetchPriority = "high";
    imgs[0] = first;

    urls.slice(1).forEach((src, i) => {
      const img = new Image();
      img.src = src;
      imgs[i + 1] = img;
    });
    imagesRef.current = imgs;
  }, [framesPath, frameCount, ext]);

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
