'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClaimTaskResultDto } from '../lib/api';
import { Button, Chip, Eyebrow, Icon, Notice, Progress } from './ui';

/**
 * A question as the client sees it. No `correctIndex`, no `explanation`:
 * the server marks the submission and withholds the answers until then.
 */
interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Which blockchain network settles VOLTARA ($VLTR) token withdrawals?',
    options: ['BNB Smart Chain (BEP-20)', 'Ethereum Mainnet (ERC-20)', 'Solana Network (SPL)', 'Bitcoin Lightning Network'],
  },
  {
    id: 2,
    question: 'What is the official VOLTARA Point to $VLTR token conversion standard?',
    options: ['1 Point = 1 $VLTR', '3 Points = 1 $VLTR', '10 Points = 1 $VLTR', '5 Points = 1 $VLTR'],
  },
  {
    id: 3,
    question: 'What is the standard base node mining rate per hour?',
    options: ['0.25 VOLTS/h', '0.50 VOLTS/h', '0.90 VOLTS/h', '1.50 VOLTS/h'],
  },
  {
    id: 4,
    question: 'How often do miners need to check in to sustain continuous node mining?',
    options: ['Every 1 Hour', 'Every 6 Hours', 'Every 12 Hours', 'Every 24 Hours'],
  },
];

function useQuizSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const context = useCallback(() => {
    if (muted) return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, [muted]);

  const playCorrect = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  }, [context]);

  const playWrong = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    [220, 180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.12;
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.1, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.22);
    });
  }, [context]);

  const playComplete = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.1;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.42);
    });
  }, [context]);

  useEffect(() => () => void ctxRef.current?.close(), []);

  return { playCorrect, playWrong, playComplete };
}

export function QuizModal({
  rewardPoints,
  customQuestions,
  onSubmit,
  onClose,
}: {
  rewardPoints: number;
  customQuestions?: QuizQuestion[] | null;
  /** Sends the answers to be marked and returns what the server awarded. */
  onSubmit: (answers: number[]) => Promise<ClaimTaskResultDto>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const questionsList = customQuestions && customQuestions.length > 0 ? customQuestions : QUIZ_QUESTIONS;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<ClaimTaskResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { playCorrect, playWrong, playComplete } = useQuizSound(muted);
  const currentQ = questionsList[currentIdx] || questionsList[0];
  const selectedIdx = answers[currentIdx] ?? null;
  const isAnswered = selectedIdx !== null;
  const isLast = currentIdx + 1 === questionsList.length;

  // Selecting only records a choice — marking happens on the server once
  // the whole set is submitted, so an answer can still be changed.
  const handleSelect = (idx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIdx] = idx;
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(answers);
      setOutcome(result);
      const quiz = result.quiz;
      if (quiz && quiz.correctCount === quiz.total) playCorrect();
      else if (quiz && quiz.correctCount === 0) playWrong();
      else playComplete();
    } catch (err) {
      // Stay on the last question so the answers are not lost to a blip.
      setError(err instanceof Error ? err.message : 'Could not submit the quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!isLast) {
      setCurrentIdx((c) => c + 1);
      return;
    }
    void handleSubmit();
  };

  if (!mounted) return null;

  const answeredCount = answers.filter((a) => a !== undefined).length;
  const progressPercent = (answeredCount / questionsList.length) * 100;
  const quiz = outcome?.quiz ?? null;
  const perfect = quiz ? quiz.correctCount === quiz.total : false;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-bg/75 p-0 backdrop-blur-md animate-fade sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-brand/20 blur-3xl" />

      <div
        className="v-panel v-hud relative w-full animate-pop overflow-hidden rounded-b-none rounded-t-3xl p-5 sm:max-w-lg sm:rounded-3xl sm:p-7"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line/15 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-hi">
              <Icon name="help" size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-ink">Web3 Knowledge Challenge</h2>
              <p className="text-xs text-ink-3">
                Answer correctly to earn <span className="v-num font-extrabold text-charge">+{rewardPoints}</span> VOLTS
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className={`grid h-8 w-8 place-items-center rounded-full border transition ${
                muted ? 'border-line/25 text-ink-3' : 'border-brand/40 bg-brand/10 text-brand-hi'
              }`}
            >
              <Icon name="bell" size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full border border-line/25 text-ink-3 transition hover:border-heat/60 hover:text-heat"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        {!quiz ? (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <Eyebrow>
                Question {currentIdx + 1} / {questionsList.length}
              </Eyebrow>
              <Chip tone="brand">
                <span className="v-num">{answeredCount}</span> / {questionsList.length}
              </Chip>
            </div>
            <Progress value={progressPercent} charge={progressPercent >= 100} className="mt-2.5" />

            <div key={currentIdx} className="v-inset mt-5 animate-rise p-4">
              <p className="text-base font-extrabold leading-snug text-ink">{currentQ.question}</p>
            </div>

            <div key={`opts-${currentIdx}`} className="v-stagger mt-4 space-y-2.5">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    disabled={submitting}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition-all disabled:opacity-60 ${
                      isSelected
                        ? 'border-charge/60 bg-charge/10 text-ink shadow-charge'
                        : 'border-line/20 bg-surface-2/50 text-ink-2 hover:border-brand-hi/60 hover:text-ink'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-extrabold ${
                          isSelected ? 'border-charge bg-charge text-bg' : 'border-line/30 text-ink-3'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{option}</span>
                    </span>
                    {isSelected && <Icon name="check" size={14} className="shrink-0 text-charge" />}
                  </button>
                );
              })}
            </div>

            {error && (
              <Notice tone="heat" className="mt-4" icon={<Icon name="flame" size={16} />}>
                {error}
              </Notice>
            )}

            <div className="mt-4 flex gap-2">
              {currentIdx > 0 && !submitting && (
                <Button variant="ghost" onClick={() => setCurrentIdx((c) => c - 1)} className="shrink-0">
                  <Icon name="chevron-left" size={14} />
                </Button>
              )}
              <Button
                variant={isLast && isAnswered ? 'charge' : 'primary'}
                onClick={handleNext}
                disabled={!isAnswered || submitting}
                loading={submitting}
                className="flex-1"
              >
                {submitting ? 'Marking…' : !isAnswered ? 'Choose an answer' : isLast ? 'Submit answers' : 'Next question'}
                {!submitting && isAnswered && <Icon name="chevron-right" size={14} />}
              </Button>
            </div>

            {isLast && isAnswered && !submitting && (
              <p className="mt-3 text-center text-[11px] text-ink-3">
                Answers are marked once. You can try again after the cooldown.
              </p>
            )}
          </div>
        ) : (
          /* Result screen — everything here comes from the server's marking. */
          <div className="mt-6 animate-pop">
            <div className="text-center">
              <span
                className={`inline-grid h-16 w-16 place-items-center rounded-2xl ${
                  perfect ? 'bg-charge/15 text-charge shadow-charge' : 'bg-brand/15 text-brand-hi'
                }`}
              >
                <Icon name={perfect ? 'trophy' : 'check'} size={28} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">{perfect ? 'Perfect score' : 'Quiz completed'}</h3>
              <p className="mt-1 text-sm text-ink-2">
                You answered <span className="v-num font-extrabold text-ink">{quiz.correctCount}</span> of {quiz.total} correctly.
              </p>

              <div className={`v-panel mt-5 p-4 ${outcome && outcome.earnedPoints > 0 ? 'v-panel--charge' : ''}`}>
                <Eyebrow tone={outcome && outcome.earnedPoints > 0 ? 'charge' : 'default'}>
                  {outcome && outcome.earnedPoints > 0 ? 'Bounty credited' : 'No points this round'}
                </Eyebrow>
                <div className="v-num mt-1 text-3xl font-extrabold text-charge">+{outcome?.earnedPoints ?? 0} VOLTS</div>
                {quiz.correctCount < quiz.total && (
                  <div className="mt-1 text-[11px] text-ink-3">
                    {quiz.correctCount}/{quiz.total} of the full {rewardPoints} VOLTS
                  </div>
                )}
              </div>
            </div>

            <div className="v-stagger mt-5 max-h-64 space-y-2.5 overflow-y-auto pr-1 text-left">
              {quiz.results.map((r, i) => {
                const q = questionsList[i];
                return (
                  <div
                    key={r.id}
                    className={`rounded-2xl border p-3 ${
                      r.correct ? 'border-ok/35 bg-ok/[0.08]' : 'border-heat/35 bg-heat/[0.08]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 shrink-0 ${r.correct ? 'text-ok' : 'text-heat'}`}>
                        <Icon name={r.correct ? 'check' : 'x'} size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-snug text-ink">{q?.question}</p>
                        {!r.correct && (
                          <p className="mt-1 text-[11px] font-semibold text-ok">Correct answer: {q?.options[r.correctIndex]}</p>
                        )}
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{r.explanation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button variant="primary" onClick={onClose} className="mt-6 w-full">
              Close
              <Icon name="chevron-right" size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
