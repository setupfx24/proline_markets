import { useState } from "react";
import { motion } from "motion/react";
import { Check, ArrowUpRight, ShieldCheck, Zap, Award } from "lucide-react";
import { PageHeader, PageContainer, SectionHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

const TRUST_POINTS = [
  { Icon: ShieldCheck, label: "Trusted by traders worldwide since 2019" },
  { Icon: Zap,         label: "Account live within 24 hours of KYC" },
  { Icon: Award,       label: "Demo account free forever — no credit card required" },
];

export default function OpenAccountPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "India",
    accountType: "ECN",
  });

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <PageHeader
        badge="Open Account"
        headline="Live in Three Minutes."
        sub="Fill the form below to start your KYC. We will email a verification link instantly. Account fully active within 24 hours."
      />

      <section className="py-20 md:py-28">
        <PageContainer>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-12 md:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeader
                badge="What You Get"
                headline="A Real Trading Edge."
                sub=""
              />

              <div className="flex flex-col gap-4">
                {TRUST_POINTS.map(({ Icon, label }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.08 * i,
                    }}
                    className="flex items-center gap-4 liquid-glass rounded-2xl px-5 py-4"
                  >
                    <div className="liquid-glass-strong rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                      <Icon className="size-4 text-foreground" />
                    </div>
                    <span className="font-body text-sm text-foreground/85">
                      {label}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-3 mt-4">
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                  Average completion
                </span>
                <span className="font-display italic text-5xl text-foreground tabular-nums">
                  3 min
                </span>
                <p className="font-body text-sm text-foreground/65 leading-relaxed">
                  All you need is a valid government ID and a selfie. We use eKYC for instant verification.
                </p>
              </div>
            </div>

            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="liquid-glass rounded-2xl p-7 md:p-8 flex flex-col gap-5"
            >
              {!submitted ? (
                <>
                  <h3 className="font-display uppercase text-2xl md:text-3xl tracking-tight mb-2">
                    Start Your Application
                  </h3>

                  <label className="flex flex-col gap-2">
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                      Full Name
                    </span>
                    <input
                      name="fullName"
                      type="text"
                      required
                      value={form.fullName}
                      onChange={onChange}
                      className="liquid-glass rounded-full px-4 py-3 font-body text-sm text-foreground bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                      Email Address
                    </span>
                    <input
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={onChange}
                      className="liquid-glass rounded-full px-4 py-3 font-body text-sm text-foreground bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                      Phone Number
                    </span>
                    <input
                      name="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={onChange}
                      className="liquid-glass rounded-full px-4 py-3 font-body text-sm text-foreground bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                        Country
                      </span>
                      <select
                        name="country"
                        value={form.country}
                        onChange={onChange}
                        className="liquid-glass rounded-full px-4 py-3 font-body text-sm text-foreground bg-transparent appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {["India", "United Kingdom", "United Arab Emirates", "Singapore", "Australia", "Other"].map((c) => (
                          <option key={c} className="bg-background text-foreground">
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                        Account Type
                      </span>
                      <select
                        name="accountType"
                        value={form.accountType}
                        onChange={onChange}
                        className="liquid-glass rounded-full px-4 py-3 font-body text-sm text-foreground bg-transparent appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {["Cent", "ECN", "Islamic", "Standard", "Proline VIP AC", "Try Demo Ac"].map((c) => (
                          <option key={c} className="bg-background text-foreground">
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="font-body text-xs text-foreground/55 leading-relaxed mt-2">
                    By submitting, you agree to our Terms and acknowledge the Risk Disclosure. CFD trading carries significant risk of loss.
                  </p>

                  <Button type="submit" variant="hero" className="mt-2 self-start">
                    Continue Application
                    <ArrowUpRight className="ml-1 size-4" />
                  </Button>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-start gap-5 py-6"
                >
                  <div className="liquid-glass-strong rounded-full w-12 h-12 flex items-center justify-center">
                    <Check className="size-5 text-primary" />
                  </div>
                  <h3 className="font-display uppercase text-3xl md:text-4xl tracking-tight">
                    Application Received.
                  </h3>
                  <p className="font-body text-foreground/70 leading-relaxed max-w-md">
                    A verification link has been sent to <span className="text-foreground">{form.email}</span>.
                    Complete your KYC to activate the account within 24 hours.
                  </p>
                </motion.div>
              )}
            </motion.form>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
