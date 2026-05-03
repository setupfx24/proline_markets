import { AccountPageLayout } from "@/components/AccountPageLayout";

export default function CrestPage() {
  return (
    <AccountPageLayout
      slug="crest"
      badge="Crest"
      pitchHeadline="The top-tier account for elite traders."
      pitchSub="Raw interbank pricing, a dedicated dealer line, and infrastructure tuned for institutional-style flow. Crest is built for the highest-volume Proline Markets clients."
      perks={[
        { title: "Raw Pricing",        body: "Spreads from 0.0 pips with direct access to deep liquidity pools." },
        { title: "Dedicated Dealer",   body: "A direct line to a Proline dealer for sizing, hedging and complex orders." },
        { title: "Free VPS Hosting",   body: "Always-on VPS bundled in — perfect for EAs and algorithmic strategies." },
      ]}
      bestFor={[
        "Institutional and prop-style traders running heavy size",
        "Algorithmic traders who need ultra-low latency execution",
        "Existing Premium clients who have outgrown their account",
        "Anyone who wants the very best conditions Proline Markets offers",
      ]}
      accentClass="ring-primary/60"
      imageLabel="Crest"
    />
  );
}
