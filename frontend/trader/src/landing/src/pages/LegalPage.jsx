import { useParams } from "react-router-dom";
import { PageHeader, PageContainer } from "@/components/PageShell";
import { CtaFooter } from "@/components/CtaFooter";
import { CONTACT_INFO } from "@/lib/forexData";

const PAGES = {
  "risk-disclosure": {
    badge: "Legal",
    headline: "Risk Disclosure.",
    sub: "Trading forex and other financial instruments involves a high level of risk and may not be suitable for all investors or traders.",
  },
  "privacy-policy": {
    badge: "Legal",
    headline: "Privacy Policy.",
    sub: "How we collect, store, and protect your personal data.",
  },
  "refund-policy": {
    badge: "Legal",
    headline: "Refund Policy.",
    sub: "Our policy regarding refunds and chargebacks for funded accounts.",
  },
  "aml-policy": {
    badge: "Legal",
    headline: "AML Policy.",
    sub: "Our anti-money laundering and counter-terrorism financing policy. Procedures, KYC, and ongoing monitoring obligations.",
  },
  sitemap: {
    badge: "Site",
    headline: "Sitemap.",
    sub: "Every page on Proline Markets, in one place.",
  },
};

export default function LegalPage() {
  const { slug } = useParams();
  const meta = PAGES[slug] ?? {
    badge: "Legal",
    headline: "Document.",
    sub: "Page content under review.",
  };

  return (
    <>
      <PageHeader badge={meta.badge} headline={meta.headline} sub={meta.sub} />
      <section className="py-20 md:py-28">
        <PageContainer>
          <div className="liquid-glass rounded-2xl p-8 md:p-12 max-w-3xl">
            <p className="font-body text-foreground/70 leading-relaxed mb-4">
              This document sets out the legal terms and disclosures applicable
              to your use of services provided by Proline Markets ("we", "us", "our").
            </p>
            <p className="font-body text-foreground/70 leading-relaxed mb-4">
              By opening an account or otherwise using our services, you confirm
              that you have read, understood, and accepted these terms. If you do
              not agree, you must not use our services.
            </p>
            <p className="font-body text-foreground/65 leading-relaxed text-sm mt-8">
              For the complete and binding version of this document, contact us at{" "}
              <span className="text-foreground">{CONTACT_INFO.email}</span>.
            </p>
          </div>
        </PageContainer>
      </section>
      <CtaFooter />
    </>
  );
}
