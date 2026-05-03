import { FileText } from 'lucide-react'

export const metadata = { title: 'Terms and Conditions â€” ProlineMarketsFX' }

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#2962FF]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#2962FF]" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Terms and Conditions</h1>
        </div>

        <p className="text-lg font-semibold text-text-primary mt-8 mb-1">ProlineMarketsFX â€” Terms and Conditions</p>
        <p className="text-sm text-text-secondary mb-10">Last updated: February 2026</p>

        <div className="space-y-8">
          <Section title="1. Acceptance of Terms">
            By creating an account and using the ProlineMarketsFX platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our services.
          </Section>

          <Section title="2. Eligibility">
            You must be at least 18 years of age and legally permitted to engage in financial trading in your jurisdiction. You are responsible for ensuring compliance with all applicable laws and regulations.
          </Section>

          <Section title="3. Account Responsibilities">
            You are solely responsible for maintaining the confidentiality of your account credentials. All activities conducted under your account are your responsibility. You agree to provide accurate and truthful information during registration and to keep your information up to date.
          </Section>

          <Section title="4. Trading Risks">
            Trading forex and other financial instruments involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. You should carefully consider your financial situation and risk tolerance before trading.
          </Section>

          <Section title="5. Deposits and Withdrawals">
            All deposits are subject to the platform&apos;s processing policies. Cryptocurrency deposits are subject to a 2.5% processing fee. Withdrawals require email verification for security purposes. Processing times may vary depending on the payment method.
          </Section>

          <Section title="6. Bonus Terms">
            Promotional bonuses, including the welcome bonus, are subject to specific terms and conditions. Bonus funds may have trading volume requirements and withdrawal restrictions. ProlineMarketsFX reserves the right to modify or discontinue bonus programs at any time.
          </Section>

          <Section title="7. Prohibited Conduct">
            You agree not to engage in any of the following:
            <List items={[
              'Market manipulation, fraud, or any form of abusive trading practices.',
              'Using the platform for money laundering or any illegal activity.',
              'Attempting to exploit system vulnerabilities or interfere with platform operations.',
              'Creating multiple accounts to circumvent platform rules or bonus limitations.',
              'Engaging in defamatory, malicious, or harmful attacks against ProlineMarketsFX, its brand, employees, partners, or other users. This includes but is not limited to spreading false information, making threatening communications, filing fraudulent complaints, or conducting coordinated campaigns intended to damage the company\u2019s reputation.',
              'Making false or unsubstantiated accusations against ProlineMarketsFX, including but not limited to publicly or privately labeling the platform as a \u201cscam,\u201d \u201cfraud,\u201d or similar defamatory terms without legitimate basis. Such conduct undermines trust and will not be tolerated, and may result in immediate account suspension or termination.',
            ]} />
          </Section>

          <Section title="8. Account Suspension and Termination">
            ProlineMarketsFX reserves the right to suspend, restrict, or terminate any account at its sole discretion, including but not limited to cases where a user:
            <List items={[
              'Violates any provision of these Terms and Conditions.',
              'Engages in malicious conduct against the brand, its affiliates, or other users.',
              'Provides false or misleading information.',
              'Is suspected of fraudulent or illegal activity.',
            ]} />
            <p className="mt-3">Upon suspension or termination, access to trading and withdrawal functions may be restricted pending investigation.</p>
          </Section>

          <Section title="9. Affiliate Program">
            Participation in the affiliate program is subject to additional terms. Affiliates must promote ProlineMarketsFX responsibly and in compliance with all applicable advertising standards. Commissions are subject to review and may be adjusted or revoked in cases of abuse.
          </Section>

          <Section title="10. PAMM Investments">
            PAMM (Percentage Allocation Management Module) investments carry inherent risks. Past performance of a PAMM manager does not guarantee future results. Investors should conduct their own due diligence before allocating funds.
          </Section>

          <Section title="11. Privacy and Data Protection">
            Your personal data is processed in accordance with our Privacy Policy. By using our services, you consent to the collection, processing, and storage of your data as described therein. We implement industry-standard security measures to protect your information.
          </Section>

          <Section title="12. Limitation of Liability">
            ProlineMarketsFX shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform. Our total liability shall not exceed the amount of funds deposited in your account.
          </Section>

          <Section title="13. Modifications">
            ProlineMarketsFX reserves the right to modify these Terms and Conditions at any time. Continued use of the platform after changes are posted constitutes acceptance of the revised terms. Users will be notified of material changes via email or platform notification.
          </Section>

          <Section title="14. Governing Law">
            These Terms and Conditions shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through the appropriate legal channels.
          </Section>

          <div className="pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
            <p className="text-text-secondary text-sm leading-relaxed">
              By checking the box and creating your account, you confirm that you have read, understood, and agree to these Terms and Conditions in their entirety.
            </p>
          </div>

          {/* Risk Disclaimer */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            <h2 className="text-lg font-bold text-text-primary mb-3">Risk Disclaimer</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Trading foreign exchange (forex) and other leveraged financial products carries a high level of risk and may not be suitable for all investors. Leverage can work both for and against you â€” while it amplifies potential profits, it equally amplifies potential losses. You could sustain a loss of some or all of your initial investment and should not invest money that you cannot afford to lose. You should be aware of all the risks associated with leveraged trading and seek independent financial advice if you have any doubts. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
      <div className="text-text-secondary text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-2 mt-3 text-text-secondary text-sm">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}
