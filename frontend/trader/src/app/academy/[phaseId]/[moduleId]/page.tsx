'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  BookOpen,
  KeyRound,
  Lightbulb,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases, lessonContent, type TopicBlock } from '@/data/academy';

function phaseSlugFromParam(phaseId: string): string {
  return phaseId.startsWith('phase-') ? phaseId : `phase-${phaseId}`;
}

function phaseIndexFromParam(phaseId: string): number {
  const raw = phaseId.startsWith('phase-') ? phaseId.replace('phase-', '') : phaseId;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n - 1 : -1;
}

export default function AcademyModulePage() {
  const params = useParams();
  const phaseIdParam = String(params.phaseId ?? '');
  const moduleId = String(params.moduleId ?? '');
  const phaseIndexFromModuleId = parseInt(moduleId.split('.')[0], 10) - 1;
  const rawPhaseIndex = phaseIndexFromParam(phaseIdParam);
  const phaseIndex = rawPhaseIndex !== -1 ? rawPhaseIndex : phaseIndexFromModuleId;
  const phase = phases[phaseIndex];
  const phaseSlug = `phase-${phaseIndex + 1}`;
  const module = phase?.modules.find((m) => m.id === moduleId);
  const moduleIndex = phase?.modules.findIndex((m) => m.id === moduleId) ?? -1;
  const content = lessonContent[moduleId as keyof typeof lessonContent];

  const router = useRouter();
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem('academy_completed');
    if (stored) setCompletedModules(new Set(JSON.parse(stored)));
  }, []);

  const isCompleted = completedModules.has(moduleId);

  function handleMarkComplete() {
    const updated = new Set(completedModules);
    updated.add(moduleId);
    setCompletedModules(updated);
    localStorage.setItem('academy_completed', JSON.stringify([...updated]));
    if (nextModule) {
      router.push(`/academy/${phaseSlug}/${nextModule.id}`);
    } else {
      router.push(`/academy/${phaseSlug}/quiz`);
    }
  }

  if (!phase || !module) {
    return (
      <DashboardShell>
        <div className="page-main max-w-4xl mx-auto text-center py-20">
          <p className="text-text-secondary">Module not found</p>
          <Link href="/academy" className="text-[#22c55e] hover:underline text-sm mt-2 inline-block">
            ← Back to Academy
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const toggleTopic = (id: number) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedTopics(new Set());
    } else {
      setExpandedTopics(new Set(content?.topics.map((t) => t.id) || []));
    }
    setAllExpanded(!allExpanded);
  };

  const prevModule = moduleIndex > 0 ? phase.modules[moduleIndex - 1] : null;
  const nextModule = moduleIndex < phase.modules.length - 1 ? phase.modules[moduleIndex + 1] : null;

  return (
    <DashboardShell>
      <div className="page-main max-w-6xl mx-auto w-full pb-8">
        <Link
          href={`/academy/${phaseSlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-[#22c55e] transition-colors mb-6 px-4 py-2 rounded-lg border border-border-glass hover:border-[#22c55e]/30"
        >
          <ArrowLeft size={14} />
          BACK TO {phase.title}
        </Link>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {phase.modules.map((m, i) => (
            <Link
              key={m.id}
              href={`/academy/${phaseSlug}/${m.id}`}
              className={clsx(
                'w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-colors',
                m.id === moduleId
                  ? 'border-[#22c55e] bg-[#22c55e]/10 text-[#22c55e]'
                  : 'border-border-glass text-text-tertiary hover:border-text-tertiary',
              )}
            >
              {i + 1}
            </Link>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs px-2.5 py-1 rounded bg-[#22c55e]/10 text-[#22c55e] font-bold border border-[#22c55e]/20">
              MODULE {module.id}
            </span>
            <span className="text-xs text-text-tertiary">{module.minutes} min read</span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">{module.title}</h1>
          <div className="w-12 h-0.5 bg-[#22c55e]" />
        </div>

        {content && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] uppercase tracking-widest text-text-tertiary">
                TOPICS COVERED ({content.topics.length})
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-[#22c55e] hover:underline font-medium uppercase tracking-wider"
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>

            <div className="space-y-2 mb-8">
              {content.topics.map((topic) => {
                const isOpen = expandedTopics.has(topic.id);
                return (
                  <div key={topic.id} className="bg-bg-secondary border border-border-glass rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg-hover transition-colors"
                    >
                      <span
                        className="w-8 h-8 rounded-full border-2 border-[#22c55e]/30 flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ color: phase.color }}
                      >
                        {String(topic.id).padStart(2, '0')}
                      </span>
                      <span className="text-text-primary text-sm font-medium flex-1">{topic.title}</span>
                      {isOpen ? (
                        <ChevronDown size={16} className="text-[#22c55e] shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-text-tertiary shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-border-glass">
                        <div className="flex items-center justify-between mt-4 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-[#22c55e]" />
                            <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-medium">
                              LESSON CONTENT
                            </span>
                          </div>
                          <span className="text-[10px] text-text-tertiary">2 min read</span>
                        </div>

                        <div className="space-y-4">
                          {topic.blocks.map((block: TopicBlock, bi: number) => {
                            if (block.type === 'definition') {
                              return (
                                <div key={bi} className="border-l-2 border-[#22c55e] bg-[#22c55e]/5 rounded-r-lg p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <BookOpen size={12} className="text-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">DEFINITION</span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed">{block.content}</p>
                                </div>
                              );
                            }
                            if (block.type === 'keyConcept') {
                              return (
                                <div key={bi} className="border-l-2 border-[#22c55e] bg-[#22c55e]/5 rounded-r-lg p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <KeyRound size={12} className="text-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">KEY CONCEPT</span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed">{block.content}</p>
                                </div>
                              );
                            }
                            if (block.type === 'practiceTip') {
                              return (
                                <div key={bi} className="bg-bg-secondary border border-border-glass rounded-xl p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Lightbulb size={12} className="text-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">PRACTICE TIP</span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed">{block.content}</p>
                                </div>
                              );
                            }
                            if (block.type === 'comparison' && block.comparisonData) {
                              const { left, right } = block.comparisonData;
                              return (
                                <div key={bi}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-0.5 bg-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">{block.content}</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-bg-secondary border border-border-glass rounded-xl p-4">
                                      <h4 className="text-text-primary font-semibold text-sm text-center mb-3">{left.title}</h4>
                                      <ul className="space-y-1.5">
                                        {left.items.map((item, li) => (
                                          <li key={li} className="text-text-secondary text-sm flex items-start gap-1.5">
                                            <span className="text-text-tertiary mt-1">·</span> {item}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="bg-bg-secondary border border-border-glass rounded-xl p-4">
                                      <h4 className="text-text-primary font-semibold text-sm text-center mb-3">{right.title}</h4>
                                      <ul className="space-y-1.5">
                                        {right.items.map((item, ri) => (
                                          <li key={ri} className="text-text-secondary text-sm flex items-start gap-1.5">
                                            <span className="text-text-tertiary mt-1">·</span> {item}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            if (block.type === 'timeline' && block.timelineData) {
                              return (
                                <div key={bi}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-0.5 bg-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">{block.content}</span>
                                  </div>
                                  <div className="space-y-0">
                                    {block.timelineData.map((item, ti) => (
                                      <div key={ti} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                          <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center text-sm shrink-0">
                                            {item.icon}
                                          </div>
                                          {ti < block.timelineData!.length - 1 && (
                                            <div className="w-px flex-1 bg-border-glass my-1" />
                                          )}
                                        </div>
                                        <div className="pb-4 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wider">{item.year}</span>
                                            <span className="text-sm font-semibold text-text-primary">{item.label}</span>
                                          </div>
                                          <p className="text-xs text-text-tertiary">{item.desc}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            if (block.type === 'sessions' && block.sessionsData) {
                              return (
                                <div key={bi}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-0.5 bg-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">{block.content}</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {block.sessionsData.map((s, si) => (
                                      <div key={si} className="bg-bg-tertiary border border-border-glass rounded-xl p-3 text-center">
                                        <div className="text-2xl mb-1">{s.flag}</div>
                                        <p className="text-text-primary text-xs font-bold">{s.city}</p>
                                        <p className="text-text-tertiary text-[10px] mt-0.5">{s.hours}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            if (block.type === 'hierarchy' && block.hierarchyData) {
                              return (
                                <div key={bi}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-0.5 bg-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">{block.content}</span>
                                  </div>
                                  <div className="space-y-0">
                                    {block.hierarchyData.map((h, hi) => (
                                      <div key={hi} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                          <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-sm shrink-0">
                                            {h.icon}
                                          </div>
                                          {hi < block.hierarchyData!.length - 1 && (
                                            <div className="w-px flex-1 border-l border-dashed border-[#22c55e]/20 my-1" />
                                          )}
                                        </div>
                                        <div className="pb-3">
                                          <p className="text-text-primary text-sm font-semibold">{h.title}</p>
                                          <p className="text-text-tertiary text-xs">{h.desc}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            if (block.type === 'stats' && block.statsData) {
                              return (
                                <div key={bi}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-0.5 bg-[#22c55e]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-bold">{block.content}</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {block.statsData.map((s, si) => (
                                      <div key={si} className="bg-bg-tertiary border border-border-glass rounded-xl p-3 text-center">
                                        <div className="text-xl mb-1">{s.icon}</div>
                                        <p className="text-text-primary text-base font-black">{s.value}</p>
                                        <p className="text-text-secondary text-xs font-semibold">{s.label}</p>
                                        <p className="text-text-tertiary text-[10px] mt-0.5">{s.sublabel}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <p key={bi} className="text-sm text-text-secondary leading-relaxed">
                                {block.content}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-l-2 border-[#22c55e] bg-bg-secondary rounded-r-xl p-5 mb-6">
              <h3 className="text-[11px] uppercase tracking-widest text-[#22c55e] font-bold mb-3">KEY TAKEAWAYS</h3>
              <div className="space-y-2">
                {content.keyTakeaways.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-[#22c55e] mt-0.5 shrink-0" />
                    <p className="text-sm text-text-secondary">{t}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-glass rounded-xl p-5 mb-6">
              <h3 className="text-[11px] uppercase tracking-widest text-text-tertiary font-bold mb-2">STUDY NOTES</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{content.studyNotes}</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
              <button
                type="button"
                onClick={handleMarkComplete}
                className={clsx(
                  'px-6 py-2.5 font-semibold rounded-lg transition-colors text-sm flex items-center gap-1.5 w-fit',
                  isCompleted
                    ? 'bg-green-600/20 text-green-400 border border-green-600/40 cursor-default'
                    : 'bg-[#22c55e] hover:bg-[#16a34a] text-white'
                )}
              >
                {isCompleted ? <><CheckCircle size={14} /> COMPLETED</> : <>MARK AS COMPLETE <ArrowRight size={14} /></>}
              </button>
              <span className="text-xs text-text-tertiary">
                {isCompleted ? 'Module completed — navigating to next' : 'Marks complete and advances to next module'}
              </span>
            </div>
          </>
        )}

        {!content && (
          <div className="bg-bg-secondary border border-border-glass rounded-xl p-8 text-center mb-8">
            <BookOpen size={24} className="text-text-tertiary mx-auto mb-2" />
            <p className="text-text-secondary text-sm">Module content is being prepared. Check back soon!</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          {prevModule ? (
            <Link
              href={`/academy/${phaseSlug}/${prevModule.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-glass text-sm text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-colors"
            >
              <ArrowLeft size={14} />
              PREV
            </Link>
          ) : (
            <div />
          )}
          {nextModule ? (
            <Link
              href={`/academy/${phaseSlug}/${nextModule.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-glass text-sm text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-colors"
            >
              NEXT MODULE
              <ArrowRight size={14} />
            </Link>
          ) : (
            <Link
              href={`/academy/${phaseSlug}/quiz`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#22c55e] text-sm text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors"
            >
              TAKE QUIZ
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
