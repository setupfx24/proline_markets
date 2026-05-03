import { AccountPageLayout } from "@/components/AccountPageLayout";

export default function ProlinePremiumPage() {
  return (
    <AccountPageLayout
      slug="proline-premium"
      badge="Proline Premium Ac"
      pitchHeadline="Experience an elite trading environment."
      pitchSub="Premium pricing, a personal manager, and priority support — tuned for serious capital and high-volume strategies."
      perks={[
        { title: "Premium Pricing",       body: "Spreads from 0.1 pips and preferential pricing on size — built for capital that moves." },
        { title: "Personal Manager",      body: "A dedicated relationship manager you can reach directly, no ticket queues." },
        { title: "Priority Support",      body: "Front-of-line access on every channel: WhatsApp, phone and email." },
      ]}
      bestFor={[
        "High-net-worth individuals and professional traders",
        "Traders running 50+ lots per session",
        "Anyone who wants a single point of contact for the relationship",
        "Traders who require VPS hosting and concierge onboarding",
      ]}
      imageLabel="Premium"
    />
  );
}
