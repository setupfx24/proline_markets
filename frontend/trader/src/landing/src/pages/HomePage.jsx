import { useRef } from "react";
import { Hero } from "@/components/Hero";
import { AccountTypes } from "@/components/AccountTypes";
import { ForexPricing } from "@/components/ForexPricing";
import { PlatformSection } from "@/components/PlatformSection";
import { Pourquoi } from "@/components/Pourquoi";
import { ServicesBento } from "@/components/ServicesBento";
import { Stats } from "@/components/Stats";
import { Testimonials } from "@/components/Testimonials";
import { MultiLangSupport } from "@/components/MultiLangSupport";
import { Awards } from "@/components/Awards";
import { AboutTeaser } from "@/components/AboutTeaser";
import { Faq } from "@/components/Faq";
import { CtaFooter } from "@/components/CtaFooter";

export default function HomePage() {
  const heroRef = useRef(null);
  return (
    <>
      <Hero scrollRef={heroRef} />
      <AccountTypes />
      <ForexPricing />
      <ServicesBento />
      <PlatformSection />
      <Pourquoi />
      <Stats />
      <Testimonials />
      <MultiLangSupport />
      <Awards />
      <AboutTeaser />
      <Faq />
      <CtaFooter />
    </>
  );
}
