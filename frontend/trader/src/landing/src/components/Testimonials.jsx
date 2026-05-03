import { Quote } from "lucide-react";
import { BlurText } from "@/components/BlurText";
import { TESTIMONIALS } from "@/lib/forexData";

function Card({ t }) {
  return (
    <div className="liquid-glass rounded-2xl p-7 w-[340px] md:w-[400px] shrink-0 flex flex-col gap-4 min-h-[220px]">
      <Quote className="size-5 text-primary/70" aria-hidden />
      {t.title && (
        <span className="font-display uppercase text-sm tracking-wide text-foreground">
          {t.title}
        </span>
      )}
      <p className="font-body text-foreground/85 italic leading-relaxed text-[15px]">
        "{t.quote}"
      </p>
      <div className="mt-auto flex items-center gap-3">
        <div className="size-9 rounded-full bg-gradient-to-br from-primary/60 to-secondary/60 shrink-0" aria-hidden />
        <div className="flex flex-col">
          <span className="font-body font-medium text-sm">{t.name}</span>
          <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
            {t.role}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const rowA = [...TESTIMONIALS, ...TESTIMONIALS];
  const half = Math.ceil(TESTIMONIALS.length / 2);
  const tail = TESTIMONIALS.slice(half).concat(TESTIMONIALS.slice(0, half));
  const rowB = [...tail, ...tail];

  return (
    <section
      id="testimonials"
      className="relative py-28 md:py-40 border-t border-border"
    >
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="flex flex-col items-center gap-5 mb-14 md:mb-20 text-center">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            Testimonials
          </span>
          <BlurText
            text="Traders Words About Us."
            as="h2"
            className="font-display uppercase text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[20ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            Real reviews from real Proline Markets clients across the globe.
          </p>
        </div>
      </div>

      <div className="group relative flex flex-col gap-5 overflow-hidden marquee-mask">
        <div
          className="flex gap-5 w-max group-hover:[animation-play-state:paused]"
          style={{ animation: "var(--animate-marquee)" }}
        >
          {rowA.map((t, i) => (
            <Card key={`a-${i}`} t={t} />
          ))}
        </div>
        <div
          className="flex gap-5 w-max group-hover:[animation-play-state:paused]"
          style={{ animation: "var(--animate-marquee-rev)" }}
        >
          {rowB.map((t, i) => (
            <Card key={`b-${i}`} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
