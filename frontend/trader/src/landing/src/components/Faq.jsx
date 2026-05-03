import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BlurText } from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { FAQ } from "@/lib/forexData";

export function Faq() {
  return (
    <section
      id="faq"
      className="relative py-28 md:py-40 border-t border-border"
    >
      <div
        className="max-w-[var(--max)] mx-auto grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-12 md:gap-16"
        style={{ paddingLeft: "var(--gutter)", paddingRight: "var(--gutter)" }}
      >
        <div className="md:sticky md:top-40 md:self-start flex flex-col gap-6">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80 self-start">
            FAQ
          </span>
          <BlurText
            text="Frequently Asked."
            as="h2"
            className="font-display uppercase text-5xl md:text-6xl leading-[0.9] tracking-tight"
          />
          <p className="font-body text-foreground/65 max-w-md">
            Everything you need to know before your first trade. Still have questions? Our team is live 24/7.
          </p>
          <div>
            <Button variant="heroGlass" asChild>
              <Link to="/support">
                Contact Support
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-border"
            >
              <AccordionTrigger className="font-display uppercase text-lg md:text-xl tracking-tight py-6 hover:no-underline data-[state=open]:text-primary text-left">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="font-body text-foreground/70 text-[15px] leading-relaxed pb-6 max-w-[60ch]">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
