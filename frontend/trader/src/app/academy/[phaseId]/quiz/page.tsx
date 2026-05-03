'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases } from '@/data/academy';

function phaseSlugFromParam(phaseId: string): string {
  return phaseId.startsWith('phase-') ? phaseId : `phase-${phaseId}`;
}

function phaseIndexFromParam(phaseId: string): number {
  const raw = phaseId.startsWith('phase-') ? phaseId.replace('phase-', '') : phaseId;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n - 1 : -1;
}

export default function AcademyQuizPage() {
  const params = useParams();
  const phaseIdParam = String(params.phaseId ?? '');
  const phaseSlug = phaseSlugFromParam(phaseIdParam);
  const phaseIndex = phaseIndexFromParam(phaseIdParam);
  const phase = phases[phaseIndex];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  if (!phase?.quiz) {
    return (
      <DashboardShell>
        <div className="page-main max-w-4xl mx-auto text-center py-20">
          <p className="text-text-secondary">Quiz not found</p>
          <Link href="/academy" className="text-[#22c55e] hover:underline text-sm mt-2 inline-block">
            ← Back to Academy
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const quiz = phase.quiz;
  const question = quiz.questions[currentQuestion];
  const answeredCount = Object.keys(selectedAnswers).length;

  const selectAnswer = (questionId: number, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

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

        <div className="bg-bg-secondary border border-[#22c55e]/20 rounded-xl p-6 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-[#22c55e] font-medium mb-1">KNOWLEDGE CHECK</p>
          <h1 className="text-xl font-bold text-text-primary mb-3">{quiz.title}</h1>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22c55e] rounded-full transition-all"
                style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-tertiary shrink-0">
              {answeredCount}/{quiz.questions.length} answered
            </span>
          </div>

          <div className="mb-6">
            <p className="text-sm text-text-primary font-medium mb-4">
              <span className="text-[#22c55e] font-bold mr-2">{String(currentQuestion + 1).padStart(2, '0')}</span>
              {question.question}
            </p>

            <div className="space-y-2">
              {question.options.map((option, i) => {
                const letter = String.fromCharCode(65 + i);
                const isSelected = selectedAnswers[question.id] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectAnswer(question.id, i)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors text-sm',
                      isSelected
                        ? 'border-[#22c55e] bg-[#22c55e]/5 text-text-primary'
                        : 'border-border-glass bg-bg-tertiary text-text-secondary hover:border-text-tertiary hover:text-text-primary',
                    )}
                  >
                    <span className={clsx('text-xs font-medium', isSelected ? 'text-[#22c55e]' : 'text-text-tertiary')}>
                      {letter}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            {currentQuestion > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestion((p) => p - 1)}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                PREV
              </button>
            ) : (
              <div />
            )}
            {currentQuestion < quiz.questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestion((p) => p + 1)}
                className="flex items-center gap-1 text-sm text-[#22c55e] hover:underline"
              >
                NEXT
                <ArrowRight size={14} />
              </button>
            ) : (
              <div />
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={answeredCount < quiz.questions.length}
          className="px-6 py-3 bg-[#22c55e]/20 text-[#22c55e] font-semibold rounded-lg text-sm uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#22c55e]/30 transition-colors"
        >
          SUBMIT ANSWERS
        </button>

        <div className="flex items-center justify-between mt-8 flex-wrap gap-2">
          <Link
            href={`/academy/${phaseSlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-glass text-sm text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-colors"
          >
            <ArrowLeft size={14} />
            BACK TO PHASE
          </Link>
          <Link
            href="/academy"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-glass text-sm text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-colors"
          >
            ALL PHASES
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
