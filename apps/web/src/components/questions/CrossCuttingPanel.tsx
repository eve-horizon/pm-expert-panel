import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// ---------------------------------------------------------------------------
// CrossCuttingPanel — slide-in panel showing open cross-cutting questions
//
// Red-themed, 480px wide, slides in from the right edge. Groups questions
// by category (conflicts, gaps, duplicates, assumptions) with a count badge
// in the header.
// ---------------------------------------------------------------------------

interface QuestionRef {
  id: string;
  entity_type: string;
  entity_id: string;
  display_id: string | null;
}

interface Question {
  id: string;
  display_id: string;
  question: string;
  answer: string | null;
  status: string;
  priority: string;
  category: string | null;
  references?: QuestionRef[];
}

interface CrossCuttingPanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onQuestionClick: (questionId: string) => void;
  onReferenceClick?: (displayId: string) => void;
}

const CATEGORY_ORDER = ['conflict', 'gap', 'duplicate', 'assumption'];
const CATEGORY_LABELS: Record<string, string> = {
  conflict: 'Conflicts',
  gap: 'Gaps',
  duplicate: 'Duplicates',
  assumption: 'Assumptions',
};

export function CrossCuttingPanel({
  projectId,
  open,
  onClose,
  onQuestionClick,
  onReferenceClick,
}: CrossCuttingPanelProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<Question[]>(`/projects/${projectId}/questions?status=open`)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, open]);

  if (!open) return null;

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Question[]>>(
    (acc, cat) => {
      acc[cat] = questions.filter((q) => q.category === cat);
      return acc;
    },
    {},
  );
  const uncategorized = questions.filter(
    (q) => !q.category || !CATEGORY_ORDER.includes(q.category),
  );

  return (
    <div
      className="fixed top-0 right-0 h-full z-[200] flex"
      data-testid="cross-cutting-panel"
    >
      {/* Scrim */}
      <div className="fixed inset-0 bg-black/20 -z-10" onClick={onClose} />

      {/* Panel */}
      <div
        className="w-[480px] h-full bg-eden-surface border-l shadow-2xl flex flex-col"
        style={{ borderLeftWidth: '3px', borderLeftColor: '#ef4444' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-eden-border bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertIcon className="w-4 h-4 text-red-600" />
            </div>
            <h2 className="text-sm font-bold text-eden-text">
              Cross-Cutting Questions
            </h2>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              {questions.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-eden-text-2 hover:bg-eden-bg transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 eden-scroll">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-red-50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-eden-text-2">
                No open cross-cutting questions
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {CATEGORY_ORDER.map((cat) => {
                const items = grouped[cat] ?? [];
                if (!items.length) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">
                      {CATEGORY_LABELS[cat]} ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((q) => (
                        <CrossCuttingCard
                          key={q.id}
                          question={q}
                          onClick={() => onQuestionClick(q.id)}
                          onReferenceClick={onReferenceClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {uncategorized.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-eden-text-2 mb-2">
                    Other ({uncategorized.length})
                  </h3>
                  <div className="space-y-2">
                    {uncategorized.map((q) => (
                      <CrossCuttingCard
                        key={q.id}
                        question={q}
                        onClick={() => onQuestionClick(q.id)}
                        onReferenceClick={onReferenceClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CrossCuttingCard — red-themed card for a single question
// ---------------------------------------------------------------------------

function CrossCuttingCard({
  question,
  onClick,
  onReferenceClick,
}: {
  question: Question;
  onClick: () => void;
  onReferenceClick?: (displayId: string) => void;
}) {
  const priorityColor =
    question.priority === 'high'
      ? 'bg-red-100 text-red-700'
      : question.priority === 'medium'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600';

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50/30 hover:bg-red-50/60 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono text-red-400">
            {question.display_id}
          </span>
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${priorityColor}`}
          >
            {question.priority}
          </span>
        </div>
        <p className="text-sm text-eden-text leading-snug">
          {question.question}
        </p>
        {question.references && question.references.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {question.references.map((ref) => (
              <button
                key={ref.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (ref.display_id) onReferenceClick?.(ref.display_id);
                }}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                {ref.display_id || ref.entity_type}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}
