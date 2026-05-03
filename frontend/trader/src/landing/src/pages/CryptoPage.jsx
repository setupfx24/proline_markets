import { PageHeader } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { MarketCategorySection } from "@/components/MarketCategorySection";
import { CRYPTO_LIST } from "@/lib/forexData";

export default function CryptoPage() {
  return (
    <>
      <PageHeader
        badge="Crypto"
        headline="Trade Crypto 24/7."
        sub="Bitcoin, Ethereum and major altcoins as CFDs — no wallet required, trade around the clock with leverage."
      />

      <MarketCategorySection
        badge="Crypto"
        headline="Major Coins, One Account."
        intro="Trade BTC, ETH, XRP, LTC, ADA and SOL as CFDs alongside your Forex and Indices positions."
        highlights={[
          { title: "24/7 Markets",    body: "Crypto markets never sleep — trade weekends and holidays." },
          { title: "No Wallet Needed", body: "Speculate on price without custody or transfer risk." },
          { title: "Long or Short",    body: "Take a position in either direction with CFD format." },
        ]}
        table={{
          headers: ["Pair", "Min Spread", "Leverage", "Availability"],
          rows: CRYPTO_LIST.map((r) => [r.name, `$${r.spread}`, r.leverage, r.availability]),
        }}
      />

      <CtaFooter />
    </>
  );
}
