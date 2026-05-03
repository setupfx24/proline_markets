'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases } from '@/data/academy';

function parsePhaseIndex(phaseId: string): number {
  const raw = phaseId.startsWith('phase-') ? phaseId.replace('phase-', '') : phaseId;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n - 1 : -1;
}

export default function AcademyPhasePage() {
  const params = useParams();
  const phaseId = String(params.phaseId ?? '');
  const phaseIndex = parsePhaseIndex(phaseId);
  const phase = phases[phaseIndex] as typeof phases[0] & { description?: string };
  const slug = `phase-${phaseIndex + 1}`;

  if (!phase) {
    return (
      <DashboardShell>
        <div className="page-main max-w-4xl mx-auto text-center py-20">
          <p className="text-text-secondary">Phase not found</p>
          <Link href="/academy" className="text-[#22c55e] hover:underline text-sm mt-2 inline-block">
            ← Back to Academy
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const completedModules = 0;
  const totalModules = phase.modules.length;

  return (
    <DashboardShell>
      <div className="page-main max-w-6xl mx-auto w-full pb-8">
        <Link
          href="/academy"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-[#22c55e] transition-colors mb-5"
        >
          <ArrowLeft size={14} />
          ALL PHASES
        </Link>

        {/* Phase Header Card */}
        <div className="rounded-xl border border-border-glass bg-bg-secondary p-6 mb-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${phase.color}20`, color: phase.color }}
            >
              ◆
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: phase.color }}>
                  PHASE {phase.num} · {phase.duration}
                </span>
                {phaseIndex > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-tertiary border border-border-glass text-text-tertiary uppercase tracking-wider">
                    Locked
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-black text-text-primary tracking-wide mb-1 uppercase">{phase.title}</h1>
              <p className="text-sm italic text-text-secondary">{phase.subtitle}</p>
            </div>
          </div>

          {totalModules > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">PHASE PROGRESS</span>
                <span className="text-xs text-text-tertiary">{completedModules}/{totalModules}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalModules > 0 ? (completedModules / totalModules) * 100 : 0}%`,
                    backgroundColor: phase.color,
                  }}
                />
              </div>
            </div>
          )}

          {phase.description && (
            <p className="text-sm text-text-secondary mt-4 leading-relaxed">{phase.description}</p>
          )}
        </div>

        {/* Module List */}
        {phase.modules.length === 0 ? (
          <div className="rounded-xl border border-border-glass bg-bg-secondary p-10 text-center">
            <p className="text-text-secondary text-sm">This phase curriculum is being prepared. Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-[11px] uppercase tracking-widest text-text-tertiary">
                {phase.modules.length} MODULES IN THIS PHASE
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider',
                    phase.level === 'BEGINNER'
                      ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  )}
                >
                  {phase.level}
                </span>
                {phase.totalMinutes > 0 && (
                  <span className="text-xs text-text-tertiary">{phase.totalMinutes} MIN TOTAL</span>
                )}
              </div>
            </div>

            <div className="space-y-0">
              {phase.modules.map((module, i) => {
                const isDone = false;
                return (
                  <div key={module.id}>
                    <Link
                      href={`/academy/${slug}/${module.id}`}
                      className={clsx(
                        'flex items-center gap-4 px-5 py-4 rounded-xl border transition-colors group',
                        isDone
                          ? 'bg-[#22c55e]/5 border-[#22c55e]/20 hover:border-[#22c55e]/40'
                          : 'bg-bg-secondary border-border-glass hover:border-text-tertiary',
                      )}
                    >
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                          isDone ? 'bg-[#22c55e]/10 border-[#22c55e] text-[#22c55e]' : 'border-border-secondary text-text-tertiary',
                        )}
                      >
                        {isDone ? <CheckCircle size={16} /> : module.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-text-primary font-semibold text-sm">{module.title}</h3>
                          {isDone && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] font-bold border border-[#22c55e]/20 uppercase tracking-wider">
                              DONE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-text-tertiary">
                            {module.topics} topics · {module.minutes} min
                          </span>
                          <span
                            className={clsx(
                              'text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider',
                              module.level === 'BEGINNER'
                                ? 'bg-[#22c55e]/10 text-[#22c55e]'
                                : 'bg-amber-500/10 text-amber-400',
                            )}
                          >
                            {module.level}
                          </span>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-text-tertiary group-hover:text-[#22c55e] transition-colors shrink-0" />
                    </Link>
                    {i < phase.modules.length - 1 && (
                      <div className="flex justify-start ml-[29px]">
                        <div className="w-px h-3 border-l border-dashed border-border-glass" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Quiz Card */}
        {phase.quiz && phase.modules.length > 0 && (
          <div className="mt-6 bg-bg-secondary border border-[#22c55e]/20 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#22c55e] font-medium mb-1">KNOWLEDGE CHECK</p>
                <h3 className="text-lg font-bold text-text-primary">{phase.quiz.title}</h3>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-32 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-[#22c55e] rounded-full" style={{ width: '0%' }} />
                  </div>
                  <p className="text-xs text-text-tertiary">0/{phase.quiz.questions.length} answered</p>
                </div>
              </div>
              <Link
                href={`/academy/${slug}/quiz`}
                className="px-4 py-2 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold transition-colors text-center whitespace-nowrap"
              >
                Start Quiz
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
