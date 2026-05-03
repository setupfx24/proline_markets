import { AccountPageLayout } from "@/components/AccountPageLayout";

export default function EcnCommissionFreePage() {
  return (
    <AccountPageLayout
      slug="ecn-commission-free"
      badge="ECN Commission Free Ac"
      pitchHeadline="Best trading conditions account."
      pitchSub="ECN execution with zero commission and tighter spreads — designed for active traders who care about every pip and every millisecond."
      perks={[
        { title: "Commission Free",   body: "No per-lot commission — what you see in the spread is what you pay." },
        { title: "ECN Execution",     body: "Direct access to deep liquidity pools for sharper fills, especially during news." },
        { title: "Up to 100 Lots",    body: "Higher per-order ceiling for traders running larger positions." },
      ]}
      bestFor={[
        "Active intraday and scalping traders",
        "EA / algo traders that need fast, deterministic fills",
        "Traders who prefer transparent, all-in pricing",
        "Anyone graduating from Pro Standard for tighter execution",
      ]}
      accentClass="ring-primary/60"
      imageLabel="ECN Commission Free"
    />
  );
}
