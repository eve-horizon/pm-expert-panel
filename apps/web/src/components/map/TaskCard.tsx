import { useState } from 'react';
import type { Task } from './types';
import { TaskCardExpanded } from './TaskCardExpanded';

// ---------------------------------------------------------------------------
// TaskCard — compact card for a single task within a step column
//
// White card with persona-colored left border. Shows persona badge, title,
// priority/status pills, source badge, device badge, and question count.
// Supports lifecycle treatments (proposed/discontinued) and handoff roles.
// Clicking the chevron expands to show TaskCardExpanded inline below.
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: Task;
  /** When true, dim the card to 12% opacity (role filter is active and this
   *  task doesn't match the highlighted persona). */
  dimmed: boolean;
  /** AI modification indicator — 'modified' (purple border) or 'added' (green border). */
  aiStatus?: 'modified' | 'added' | null;
  /** Called when the user clicks the open-questions pill. Receives the first open question's ID. */
  onQuestionClick?: (questionId: string) => void;
}

// Priority pill colors
const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

// Status pill colors
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
};

// Source badge color map
const SOURCE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  research:    { border: '#6b7280', bg: 'rgba(107,114,128,0.1)', text: '#6b7280' },
  transcript:  { border: '#0891b2', bg: 'rgba(8,145,178,0.1)',   text: '#0891b2' },
  'scope-doc': { border: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  text: '#7c3aed' },
  both:        { border: '#059669', bg: 'rgba(5,150,105,0.1)',    text: '#059669' },
  ingestion:   { border: '#6b7280', bg: 'rgba(107,114,128,0.1)', text: '#6b7280' },
};

// Device badge styles
const DEVICE_STYLES: Record<string, string> = {
  desktop: 'bg-gray-100 text-gray-500',
  mobile:  'bg-amber-50 text-amber-700',
  all:     'bg-indigo-50 text-indigo-700',
};

export function TaskCard({ task, dimmed, aiStatus, onQuestionClick }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const personaColor = task.persona?.color ?? '#9ca3af';
  const lifecycle = task.lifecycle ?? 'current';
  const roleInJourney = task.role_in_journey ?? 'owner';

  // --- Border color logic ---
  // AI status overrides persona; lifecycle/handoff may override further
  let borderColor = aiStatus === 'modified' ? '#8b5cf6'
    : aiStatus === 'added' ? '#10b981'
    : personaColor;

  // Lifecycle overrides
  if (lifecycle === 'proposed') borderColor = '#10b981';
  if (lifecycle === 'discontinued') borderColor = '#9ca3af';

  const priorityStyle =
    PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600';
  const statusStyle =
    STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600';
  const openQuestions = task.questions.filter(
    (q) => q.status !== 'resolved',
  ).length;

  // --- Card-level style overrides ---
  const cardStyle: React.CSSProperties = {
    borderLeftWidth: roleInJourney === 'handoff' ? '2px' : '3px',
    borderLeftColor: borderColor,
    borderLeftStyle: roleInJourney === 'handoff' ? 'dashed' : 'solid',
    opacity: dimmed ? 0.12
      : lifecycle === 'discontinued' ? 0.45
      : roleInJourney === 'handoff' ? 0.85
      : 1,
  };

  if (lifecycle === 'proposed') {
    cardStyle.background = 'linear-gradient(135deg, #f0fdf4, #fff)';
  } else if (lifecycle === 'discontinued') {
    cardStyle.background = '#f9fafb';
  } else if (roleInJourney === 'handoff') {
    cardStyle.background = '#fafafa';
  }

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 transition-all duration-150"
      data-display-id={task.display_id}
      style={cardStyle}
    >
      {/* Compact view */}
      <div className="px-3 py-2.5">
        {/* Top row: persona badge + lifecycle/handoff badges + chevron */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {task.persona && (
              <span
                className="inline-flex items-center justify-center flex-shrink-0
                  w-6 h-6 rounded-md text-[10px] font-bold text-white uppercase"
                style={{ backgroundColor: task.persona.color }}
                title={task.persona.name}
              >
                {task.persona.code.slice(0, 2)}
              </span>
            )}
            <span className="text-[10px] font-mono text-eden-text-2 flex-shrink-0">
              {task.display_id}
            </span>

            {/* Lifecycle badges */}
            {lifecycle === 'proposed' && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                style={{
                  color: '#059669',
                  backgroundColor: 'rgba(5,150,105,0.1)',
                  border: '1px solid #059669',
                }}
              >
                2.0 Proposed
              </span>
            )}
            {lifecycle === 'discontinued' && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider line-through"
                style={{
                  color: '#9ca3af',
                  backgroundColor: 'rgba(156,163,175,0.1)',
                  border: '1px solid #9ca3af',
                }}
              >
                Discontinued
              </span>
            )}

            {/* Handoff / Shared badges */}
            {roleInJourney === 'handoff' && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                style={{
                  color: '#a16207',
                  backgroundColor: 'rgba(234,179,8,0.15)',
                  border: '1px solid #eab308',
                }}
              >
                {task.handoff_label ?? 'Handoff'}
              </span>
            )}
            {roleInJourney === 'shared' && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                style={{
                  color: '#2563eb',
                  backgroundColor: 'rgba(37,99,235,0.1)',
                  border: '1px solid #2563eb',
                }}
              >
                Shared
              </span>
            )}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 transition-colors text-eden-text-2"
            aria-label={expanded ? 'Collapse task' : 'Expand task'}
          >
            <ChevronIcon
              className={`w-4 h-4 transition-transform duration-150 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Title */}
        <h4
          className={`text-sm font-medium leading-snug mb-2 ${
            lifecycle === 'discontinued'
              ? 'text-gray-400 line-through'
              : 'text-eden-text'
          }`}
        >
          {task.title}
        </h4>

        {/* Pills row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${priorityStyle}`}
          >
            {task.priority}
          </span>
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${statusStyle}`}
          >
            {task.status}
          </span>

          {/* Source badge */}
          {task.source_type != null && (
            <SourceBadge sourceType={task.source_type} />
          )}

          {/* Device badge */}
          {task.device && (
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                DEVICE_STYLES[task.device] ?? 'bg-gray-100 text-gray-500'
              }`}
            >
              {task.device}
            </span>
          )}

          {openQuestions > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const firstOpen = task.questions.find((q) => q.status !== 'resolved');
                if (firstOpen) onQuestionClick?.(firstOpen.id);
              }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-eden-q-bg text-eden-q-text hover:bg-eden-q-bg/80 transition-colors"
              data-testid="question-pill"
            >
              <QuestionIcon className="w-3 h-3" />
              {openQuestions}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3">
          <TaskCardExpanded
            userStory={task.user_story}
            acceptanceCriteria={task.acceptance_criteria}
            questions={task.questions}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceBadge — small colored badge indicating data provenance
// ---------------------------------------------------------------------------

const DEFAULT_SOURCE_COLOR = { border: '#6b7280', bg: 'rgba(107,114,128,0.1)', text: '#6b7280' };

function SourceBadge({ sourceType }: { sourceType: string }) {
  const src = SOURCE_COLORS[sourceType] ?? DEFAULT_SOURCE_COLOR;
  return (
    <span
      className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase"
      style={{
        color: src.text,
        backgroundColor: src.bg,
        border: `1px solid ${src.border}`,
        borderRadius: '3px',
      }}
    >
      {sourceType}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 10.5a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM8 4.5A1.75 1.75 0 006.25 6.25a.5.5 0 01-1 0A2.75 2.75 0 118 9a.5.5 0 01-.5-.5V7.25a.5.5 0 011 0v.838A1.75 1.75 0 008 4.5z" />
    </svg>
  );
}
