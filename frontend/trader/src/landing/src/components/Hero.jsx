import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, Play } from "lucide-react";
import { ScrubSequence } from "@/components/ScrubSequence";
import { LiveTickerBar } from "@/components/LiveTickerBar";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { Button } from "@/components/ui/button";
import { FRAMES_PATH, FRAME_COUNT, FRAME_EXT } from "@/lib/constants";
import { HERO_SLIDES, BRAND } from "@/lib/forexData";

const SLIDE_DURATION = 6000;

export function Hero({ scrollRef }) {
  const [index, setIndex] = useState(0);
  const slide = HERO_SLIDES[index];

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, []);

  return (
    <section ref={scrollRef} className="relative h-screen bg-background">
      <div className="relative h-screen w-full overflow-hidden">
        <BackgroundPaths className="z-0" />
        <ScrubSequence
          framesPath={FRAMES_PATH}
          frameCount={FRAME_COUNT}
          ext={FRAME_EXT}
          scrollTargetRef={scrollRef}
          className="absolute inset-0 w-full h-full z-[1]"
        />
        <p className="sr-only">
          {BRAND.name} — {BRAND.tagline}.
        </p>

        <div className="absolute inset-0 z-[2] bg-[radial-gradient(120%_80%_at_50%_60%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div className="absolute bottom-0 inset-x-0 h-[40vh] z-[3] gradient-fade-b pointer-events-none" />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/85 mb-6">
            {BRAND.tagline}
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <h1 className="font-display uppercase text-[clamp(48px,8vw,120px)] leading-[0.95] tracking-[-0.02em] text-foreground max-w-[16ch] font-light">
                {slide.heading.split(" ").map((word, wi) => (
                  <motion.span
                    key={`${index}-${wi}`}
                    className="inline-block will-change-[filter,transform,opacity] mr-[0.28em] last:mr-0"
                    initial={{ filter: "blur(14px)", opacity: 0, y: 28 }}
                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.8,
                      ease: [0.22, 1, 0.36, 1],
                      delay: wi * 0.08,
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                key={`sub-${index}`}
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.15 + slide.heading.split(" ").length * 0.08,
                }}
                className="mt-6 font-body text-base md:text-lg text-foreground/75 max-w-xl leading-relaxed"
              >
                {slide.sub}
              </motion.p>

              <motion.div
                key={`cta-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.4 + slide.heading.split(" ").length * 0.08,
                }}
                className="mt-8 flex flex-wrap items-center justify-center gap-3"
              >
                <Button variant="hero" asChild>
                  <a href={slide.ctaPrimary.href}>
                    {slide.ctaPrimary.label}
                    <ArrowUpRight className="ml-1 size-4" />
                  </a>
                </Button>
                <Button variant="heroGlass" asChild>
                  <a href={slide.ctaSecondary.href} target="_blank" rel="noopener noreferrer">
                    <Play className="mr-1.5 size-4" />
                    {slide.ctaSecondary.label}
                  </a>
                </Button>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex items-center gap-2">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-primary" : "w-3 bg-foreground/30 hover:bg-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.7 }}
          className="absolute bottom-0 inset-x-0 z-20"
        >
          <LiveTickerBar />
        </motion.div>
      </div>
    </section>
  );
}
