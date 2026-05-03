import { AccountPageLayout } from "@/components/AccountPageLayout";

export default function TryDemoPage() {
  return (
    <AccountPageLayout
      slug="demo"
      badge="Try Demo Ac"
      pitchHeadline="Practice risk-free with virtual funds."
      pitchSub="A live-market environment with virtual money — no credit card needed. Test platforms, strategies and Expert Advisors before you go live."
      perks={[
        { title: "Virtual Funds",      body: "Pre-loaded virtual balance you can reset whenever you want." },
        { title: "Live Pricing",       body: "Demo data mirrors the real market — practice exactly how you will trade live." },
        { title: "Never Expires",      body: "Keep your demo account open as long as you need to build confidence." },
      ]}
      bestFor={[
        "Beginners learning how the platforms and order types work",
        "Strategy testing and Expert Advisor backtesting",
        "Existing live traders trialling a new approach risk-free",
        "Anyone who wants to evaluate Proline Markets before depositing",
      ]}
      imageLabel="Demo"
    />
  );
}
