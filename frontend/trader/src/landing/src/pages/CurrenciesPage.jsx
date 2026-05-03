import { PageHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { MarketCategorySection } from "@/components/MarketCategorySection";
import { FOREX_PAIRS } from "@/lib/forexData";

export default function CurrenciesPage() {
  return (
    <>
      <PageHeader
        badge="Currencies"
        headline="Trade the World's Currencies."
        sub="Major, minor and exotic currency pairs. Tight spreads, deep liquidity and 24/5 market access on every Proline Markets account."
      />

      <MarketCategorySection
        badge="Currencies"
        headline="Major, Minor & Exotic Pairs."
        intro="Trade EUR/USD, GBP/USD, USD/JPY and dozens more from a single account with competitive pricing."
        highlights={[
          { title: "70+ Pairs",   body: "Trade across major, minor and exotic FX pairs from one platform." },
          { title: "24/5 Access", body: "Markets open Sunday evening to Friday close — trade any session." },
          { title: "Deep Liquidity", body: "Interbank-grade liquidity for fast fills and tight spreads." },
        ]}
        table={{
          headers: ["Pair", "Min Spread", "Leverage", "Min Lot", "Category"],
          rows: FOREX_PAIRS.map((r) => [r.pair, `${r.spread} pip`, r.leverage, r.minLot, r.category]),
        }}
      />

      <CtaFooter />
    </>
  );
}
