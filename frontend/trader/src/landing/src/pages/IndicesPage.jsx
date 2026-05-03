import { PageHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { MarketCategorySection } from "@/components/MarketCategorySection";
import { INDICES_LIST } from "@/lib/forexData";

export default function IndicesPage() {
  return (
    <>
      <PageHeader
        badge="Indices"
        headline="Trade Global Stock Indices."
        sub="US30, NAS100, SPX500, NIFTY50, FTSE100 and more — speculate on the world's biggest equity markets as CFDs."
      />

      <MarketCategorySection
        badge="Indices"
        headline="Global Markets, One Account."
        intro="Take a position on the broad market direction without picking individual stocks."
        highlights={[
          { title: "30+ Indices",   body: "Trade Wall Street, London, Frankfurt, Tokyo and Mumbai indices." },
          { title: "CFD Format",    body: "Go long or short. No share ownership required." },
          { title: "Long Sessions", body: "Index hours follow the underlying exchange's full trading day." },
        ]}
        table={{
          headers: ["Index", "Min Spread", "Leverage", "Trading Hours"],
          rows: INDICES_LIST.map((r) => [r.name, `${r.spread} pts`, r.leverage, r.hours]),
        }}
      />

      <CtaFooter />
    </>
  );
}
