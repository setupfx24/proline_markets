import { PageHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { MarketCategorySection } from "@/components/MarketCategorySection";
import { COMMODITIES_LIST } from "@/lib/forexData";

export default function CommoditiesPage() {
  return (
    <>
      <PageHeader
        badge="Commodities"
        headline="Trade Metals & Energy."
        sub="Gold, Silver, Crude Oil, Brent, Natural Gas and Platinum — speculate on the world's safe-havens and energy markets."
      />

      <MarketCategorySection
        badge="Commodities"
        headline="Hard Assets, Easy Access."
        intro="Trade physical commodities as CFDs with competitive spreads and flexible leverage."
        highlights={[
          { title: "Precious Metals",  body: "Gold and Silver as classic hedges and intraday plays." },
          { title: "Energy",           body: "WTI, Brent and Natural Gas with extended trading hours." },
          { title: "Tight Spreads",    body: "Sharp pricing across all commodity instruments." },
        ]}
        table={{
          headers: ["Instrument", "Min Spread", "Leverage", "Category", "Hours"],
          rows: COMMODITIES_LIST.map((r) => [r.name, r.spread, r.leverage, r.category, r.hours]),
        }}
      />

      <CtaFooter />
    </>
  );
}
