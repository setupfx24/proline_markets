import { PageHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { MarketCategorySection } from "@/components/MarketCategorySection";
import { STOCKS_LIST, ETFS_LIST } from "@/lib/forexData";

export default function CfdsPage() {
  return (
    <>
      <PageHeader
        badge="CFDs"
        headline="Trade CFDs on Stocks & ETFs."
        sub="Go long or short on global blue-chip stocks and major ETFs without owning the underlying assets."
      />

      <MarketCategorySection
        badge="Stocks"
        headline="Single-Stock CFDs."
        intro="Trade Apple, Tesla, Reliance, Infosys and other global stocks with leverage — no share ownership required."
        highlights={[
          { title: "Global Exchanges", body: "NASDAQ, NYSE, LSE, NSE — trade across major exchanges." },
          { title: "Long or Short",     body: "Profit from rising or falling markets with CFD format." },
          { title: "Fractional Lots",   body: "Trade as little as 0.01 lot to size positions exactly." },
        ]}
        table={{
          headers: ["Instrument", "Min Spread", "Leverage", "Exchange"],
          rows: STOCKS_LIST.map((r) => [r.name, r.spread, r.leverage, r.exchange]),
        }}
      />

      <MarketCategorySection
        badge="ETFs"
        headline="ETF CFDs."
        intro="Diversify with ETF CFDs tracking major indices, sectors and themes from one unified platform."
        highlights={[
          { title: "Index Trackers",   body: "S&P 500, MSCI World, QQQ — ride the broad market." },
          { title: "Sector Plays",     body: "Tech, energy, gold, emerging markets — pick your theme." },
          { title: "Single Account",   body: "Trade ETFs alongside Forex, Indices and Crypto." },
        ]}
        table={{
          headers: ["ETF", "Min Spread", "Leverage", "Category"],
          rows: ETFS_LIST.map((r) => [r.name, r.spread, r.leverage, r.category]),
        }}
      />

      <CtaFooter />
    </>
  );
}
