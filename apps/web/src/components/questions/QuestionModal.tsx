import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

// ---------------------------------------------------------------------------
// QuestionModal — full-detail view for a single question
//
// Centered modal with backdrop blur. Shows question text, priority/category
// badges, entity reference tags, and a textarea for answering. Autosaves
// the answer with a 1-second debounce. "Evolve Map" button triggers the
// AI evolution pipeline.
// ---------------------------------------------------------------------------

interface QuestionRef {
  id: string;
  entity_type: string;
  entity_id: string;
  display_id: string | null;
}

interface QuestionDetail {
  id: string;
  display_id: string;
  question: string;
  answer: string | null;
  status: string;
  priority: string;
  category: string | null;
  references: QuestionRef[];
}

interface QuestionModalProps {
  questionId: string | null;
  onClose: () => void;
  onReferenceClick?: (displayId: string) => void;
}

export function QuestionModal({
  questionId,
  onClose,
  onReferenceClick,
}: QuestionModalProps) {
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [evolving, setEvolving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!questionId) return;
    setLoading(true);
    api
      .get<QuestionDetail>(`/questions/${questionId}`)
      .then((q) => {
        setDetail(q);
        setAnswer(q.answer ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [questionId]);

  // Autosave with debounce
  const handleAnswerChange = useCallback(
    (value: string) => {
      setAnswer(value);
      setSaveStatus('saving');

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!questionId) return;
        try {
          await api.patch(`/questions/${questionId}`, { answer: value });
          setSaveStatus('saved');
        } catch {
          setSaveStatus('idle');
        }
      }, 1000);
    },
    [questionId],
  );

  const handleEvolve = async () => {
    if (!questionId || !answer.trim()) return;
    setEvolving(true);
    try {
      await api.post(`/questions/${questionId}/evolve`, {
        answer: answer.trim(),
      });
      setToast('Question evolution triggered — map update incoming');
      setTimeout(() => {
        setToast(null);
        onClose();
      }, 2000);
    } catch {
      setToast('Failed to trigger evolution');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setEvolving(false);
    }
  };

  const handleRefClick = (displayId: string) => {
    onClose();
    // Small delay to let modal close before scrolling
    setTimeout(() => onReferenceClick?.(displayId), 100);
  };

  if (!questionId) return null;

  const priorityColor =
    detail?.priority === 'high'
      ? 'bg-red-100 text-red-700'
      : detail?.priority === 'medium'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';

  const categoryColor =
    detail?.category === 'conflict'
      ? 'bg-red-100 text-red-700'
      : detail?.category === 'gap'
        ? 'bg-amber-100 text-amber-700'
        : detail?.category === 'duplicate'
          ? 'bg-purple-100 text-purple-700'
          : 'bg-gray-100 text-gray-600';

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      data-testid="question-modal"
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[680px] max-h-[85vh] bg-eden-surface rounded-2xl shadow-2xl border border-eden-border flex flex-col overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : detail ? (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-eden-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-eden-text-2">
                    {detail.display_id}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${priorityColor}`}
                  >
                    {detail.priority}
                  </span>
                  {detail.category && (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${categoryColor}`}
                    >
                      {detail.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="text-eden-text-2 hover:text-eden-text transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <p className="text-base font-medium text-eden-text mt-3 leading-relaxed">
                {detail.question}
              </p>

              {/* Reference tags */}
              {detail.references.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {detail.references.map((ref) => (
                    <button
                      key={ref.id}
                      onClick={() =>
                        ref.display_id && handleRefClick(ref.display_id)
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono
                                 bg-eden-accent/10 text-eden-accent hover:bg-eden-accent/20 transition-colors"
                    >
                      {ref.display_id || ref.entity_type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Response area */}
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-eden-text-2 uppercase tracking-wider">
                  Response
                </label>
                <span
                  className={`text-[10px] font-medium ${
                    saveStatus === 'saved'
                      ? 'text-emerald-600'
                      : saveStatus === 'saving'
                        ? 'text-amber-600'
                        : 'text-transparent'
                  }`}
                >
                  {saveStatus === 'saved'
                    ? 'Saved'
                    : saveStatus === 'saving'
                      ? 'Saving...'
                      : '.'}
                </span>
              </div>
              <textarea
                value={answer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Type your answer..."
                rows={6}
                className="w-full rounded-xl border border-eden-border bg-eden-bg px-4 py-3
                           text-sm text-eden-text placeholder:text-eden-text-2/40
                           focus:outline-none focus:ring-2 focus:ring-eden-accent/30 focus:border-eden-accent
                           resize-y"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-eden-border flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-eden-bg text-eden-text
                           hover:bg-eden-border transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleEvolve}
                disabled={evolving || !answer.trim() || detail.status !== 'open'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                           bg-eden-accent text-white hover:bg-eden-accent/90 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="evolve-btn"
              >
                <EvolveIcon className="w-4 h-4" />
                {evolving ? 'Evolving...' : 'Evolve Map'}
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load question
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400]"
          data-testid="toast"
        >
          <div className="bg-eden-text text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function EvolveIcon({ className }: { className?: string }) {
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
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
