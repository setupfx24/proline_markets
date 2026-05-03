'use client';

import DashboardShell from '@/components/layout/DashboardShell';
import { Blocks, LogIn, UserPlus, ExternalLink, Cpu, BarChart3, Zap, Shield } from 'lucide-react';

export default function EdgeBuilderPage() {
  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Blocks size={20} className="text-[#22c55e]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Edge Builder</h1>
            <p className="text-xs text-text-tertiary">Build, backtest & deploy automated trading strategies</p>
          </div>
        </div>

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border-primary bg-gradient-to-br from-[#22c55e]/5 via-bg-secondary to-bg-secondary p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#22c55e]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
              Automate Your Trading with <span className="text-[#22c55e]">Edge Builder</span>
            </h2>
            <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
              Our powerful algo trading platform lets you create custom strategies, backtest them against historical data, 
              and deploy them live on your ProlineMarketsFX accounts â€” all without writing a single line of code.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { icon: Cpu, label: 'Strategy Builder' },
                { icon: BarChart3, label: 'Backtesting' },
                { icon: Zap, label: 'Live Deployment' },
                { icon: Shield, label: 'Risk Controls' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-base/80 border border-border-primary text-text-secondary"
                >
                  <Icon size={13} className="text-[#22c55e]" />
                  {label}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <a
                href="https://algo.ProlineMarketsfx.com/auth/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold shadow-lg shadow-[#22c55e]/20 transition-all hover:shadow-[#22c55e]/30 active:scale-[0.98]"
              >
                <LogIn size={16} />
                Login to Edge Builder
                <ExternalLink size={13} className="opacity-60" />
              </a>
              <a
                href="https://algo.ProlineMarketsfx.com/auth/register"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#22c55e]/30 hover:border-[#22c55e]/60 bg-[#22c55e]/5 hover:bg-[#22c55e]/10 text-[#22c55e] text-sm font-semibold transition-all active:scale-[0.98]"
              >
                <UserPlus size={16} />
                Create Account
                <ExternalLink size={13} className="opacity-60" />
              </a>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              title: 'No Code Required',
              desc: 'Visual strategy builder with drag-and-drop indicators, conditions, and actions.',
              icon: Blocks,
            },
            {
              title: 'Real-Time Execution',
              desc: 'Strategies execute directly on your ProlineMarketsFX live or demo accounts.',
              icon: Zap,
            },
            {
              title: 'Full Backtesting',
              desc: 'Test your strategies against years of historical market data before going live.',
              icon: BarChart3,
            },
          ].map(({ title, desc, icon: Icon }) => (
            <div
              key={title}
              className="rounded-xl border border-border-primary bg-bg-secondary p-4 space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center">
                <Icon size={16} className="text-[#22c55e]" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="rounded-xl border border-border-primary bg-bg-secondary/50 p-4 flex items-start gap-3">
          <Shield size={16} className="text-[#22c55e] shrink-0 mt-0.5" />
          <p className="text-xs text-text-tertiary leading-relaxed">
            Edge Builder is a separate platform integrated with your ProlineMarketsFX account. 
            Your API credentials from <span className="text-text-secondary font-medium">Algo Connector</span> are 
            used to connect your strategies to your trading accounts securely.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
