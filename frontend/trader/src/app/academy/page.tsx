'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases } from '@/data/academy';

const phaseMeta = [
  { icon: 'â—†', border: 'border-[#22c55e]/30', bg: 'bg-[#22c55e]/10' },
  { icon: 'â—', border: 'border-[#22c55e]/30', bg: 'bg-[#22c55e]/10' },
  { icon: 'â—‰', border: 'border-[#22c55e]/30', bg: 'bg-[#22c55e]/10' },
  { icon: 'â– ', border: 'border-teal-400/30', bg: 'bg-teal-500/10' },
  { icon: 'â—†', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  { icon: 'â–²', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  { icon: 'â—‡', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  { icon: 'â˜…', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
];

const displayModuleCount = (i: number) => {
  const n = phases[i]?.modules.length ?? 0;
  return n > 0 ? n : 5;
};

export default function AcademyPage() {
  const done = 0;
  const pct = 0;
  const studyTime = '21h';

  return (
    <DashboardShell>
      <div className="page-main max-w-6xl mx-auto w-full pb-8">
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1.5 rounded-full border border-[#22c55e]/30 text-[#22c55e] text-xs font-medium tracking-wider uppercase mb-4">
            â— CURRICULUM
          </div>
          <h1 className="text-3xl font-light text-text-primary tracking-wider mb-1">
            ProlineMarkets <span className="font-bold italic">FOREX</span> ACADEMY
          </h1>
          <p className="text-[#22c55e] text-sm tracking-widest uppercase">MASTER FOREX TRADING FROM BEGINNER TO PROFESSIONAL</p>

          <div className="flex items-center justify-center gap-8 mt-6 mb-4">
            {[
              { value: String(phases.length), label: 'PHASES' },
              { value: '44', label: 'MODULES' },
              { value: String(done), label: 'DONE' },
              { value: studyTime, label: 'STUDY TIME' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-text-primary">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="text-center mb-4">
            <p className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Overall Progress</p>
            <p className="text-sm text-[#22c55e] font-medium">
              {pct}% Complete ({done}/44)
            </p>
            <div className="h-2 max-w-md mx-auto mt-3 rounded-full bg-bg-secondary overflow-hidden border border-border-primary">
              <div className="h-full bg-[#22c55e] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            {phases.map((phase, i) => (
              <div key={phase.id} className="text-center">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold mb-1',
                    i === 0 ? 'border-[#22c55e] text-[#22c55e]' : 'border-border-secondary text-text-tertiary',
                  )}
                >
                  {i + 1}
                </div>
                <p className="text-[9px] text-text-tertiary">
                  0/{displayModuleCount(i)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {phases.map((phase, i) => {
            const meta = phaseMeta[i] ?? phaseMeta[0];
            const locked = i > 0;
            const modCount = phase.modules.length || displayModuleCount(i);
            return (
              <Link
                key={phase.id}
                href={`/academy/phase-${i + 1}`}
                className={clsx(
                  'block rounded-xl p-5 hover:border-text-tertiary transition-colors group border bg-bg-secondary',
                  i === phases.length - 2 ? clsx(meta.border, 'bg-purple-500/5') : i === phases.length - 1 ? clsx(meta.border, 'bg-yellow-500/5') : 'border-border-glass',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0', meta.bg)}
                      style={{ color: phase.color }}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold tracking-wider" style={{ color: phase.color }}>
                          PHASE {phase.num}
                        </span>
                        <span className="text-[10px] text-text-tertiary">{phase.duration}</span>
                        {locked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-tertiary border border-border-glass text-text-tertiary uppercase tracking-wider">
                            Locked
                          </span>
                        )}
                      </div>
                      <h3 className="text-text-primary font-bold text-lg">{phase.title}</h3>
                      <p className="text-xs text-text-secondary italic">{phase.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-text-tertiary">
                      0/{modCount}
                    </span>
                    <ArrowRight size={16} className="text-text-tertiary group-hover:text-[#22c55e] transition-colors" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 ml-14">
                  <span className="text-[10px] text-text-tertiary">0%</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-8 text-[10px] uppercase tracking-widest text-text-tertiary">
          <span>ProlineMarkets FOREX ACADEMY</span>
          <span>8 PHASES Â· 44 MODULES</span>
        </div>
      </div>
    </DashboardShell>
  );
}
