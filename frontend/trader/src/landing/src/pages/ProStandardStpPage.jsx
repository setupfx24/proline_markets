import { AccountPageLayout } from "@/components/AccountPageLayout";

export default function ProStandardStpPage() {
  return (
    <AccountPageLayout
      slug="pro-standard-stp"
      badge="Pro Standard STP"
      pitchHeadline="A trading account ideal for all."
      pitchSub="Start trading with a low entry deposit and straight-through processing on every order. Built for retail traders who want a simple, transparent setup."
      perks={[
        { title: "Low Entry",         body: "Open with just $100 — perfect for traders growing into the markets." },
        { title: "STP Execution",     body: "Orders routed straight through to liquidity providers — no dealing-desk interference." },
        { title: "All Instruments",   body: "Trade Currencies, Indices, CFDs, Commodities and Crypto from one account." },
      ]}
      bestFor={[
        "First-time live traders moving up from demo",
        "Traders who prefer no commission and a slightly wider spread",
        "Anyone who wants flexibility without high deposit requirements",
        "Day traders, swing traders, and position traders alike",
      ]}
      imageLabel="Pro Standard"
    />
  );
}
