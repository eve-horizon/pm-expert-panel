import { useState } from 'react';
import { api } from '../../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangesetItem {
  id: string;
  entity_type: string;
  operation: string;
  before_state: any;
  after_state: any;
  status: string;
  description: string | null;
  display_reference: string | null;
}

interface ChangesetDetail {
  id: string;
  title: string;
  reasoning: string | null;
  source: string | null;
  status: string;
  created_at: string;
  items: ChangesetItem[];
}

type ItemOperation = 'add' | 'modify' | 'resolve';

interface ChangesetReviewModalProps {
  detail: ChangesetDetail | null;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// ChangesetReviewModal
// ---------------------------------------------------------------------------

export function ChangesetReviewModal({
  detail,
  loading,
  onClose,
  onRefresh,
}: ChangesetReviewModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const isDraft = detail?.status === 'draft';
  const hasPendingItems = detail?.items.some((i) => i.status === 'pending') ?? false;

  // Bulk accept all
  const handleAcceptAll = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/changesets/${detail.id}/accept`);
      onRefresh();
    } catch {
      // stay on modal so user can retry
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk reject all
  const handleRejectAll = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/changesets/${detail.id}/reject`);
      onRefresh();
    } catch {
      // stay on modal so user can retry
    } finally {
      setActionLoading(false);
    }
  };

  // Per-item decision
  const handleItemDecision = async (itemId: string, decision: 'accepted' | 'rejected') => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/changesets/${detail.id}/review`, {
        decisions: [{ item_id: itemId, status: decision }],
      });
      onRefresh();
    } catch {
      // keep modal open
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-eden-surface rounded-eden shadow-modal border border-eden-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-eden-border flex-shrink-0">
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : detail ? (
            <div>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold text-eden-text">
                  {detail.title}
                </h2>
                <button
                  onClick={onClose}
                  className="text-eden-text-2 hover:text-eden-text transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {detail.reasoning && (
                <p className="text-sm text-eden-text-2 mt-2">
                  {detail.reasoning}
                </p>
              )}

              <div className="flex items-center gap-3 mt-3">
                {detail.source && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-eden-text-2 bg-eden-bg px-2.5 py-1 rounded-full">
                    <SourceIcon className="w-3.5 h-3.5" />
                    {detail.source}
                  </span>
                )}
                <span className="text-xs text-eden-text-2">
                  {detail.items.length} item{detail.items.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-600">Failed to load changeset details.</p>
          )}
        </div>

        {/* Bulk actions */}
        {detail && isDraft && hasPendingItems && (
          <div className="px-6 py-3 border-b border-eden-border flex items-center gap-3 bg-eden-bg/50 flex-shrink-0">
            <button
              onClick={handleAcceptAll}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         bg-emerald-600 text-white hover:bg-emerald-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              Accept All
            </button>
            <button
              onClick={handleRejectAll}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         bg-red-600 text-white hover:bg-red-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XIcon className="w-3.5 h-3.5" />
              Reject All
            </button>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <ItemsSkeleton />
          ) : detail ? (
            detail.items.length === 0 ? (
              <p className="text-center text-sm text-eden-text-2 py-8">
                No items in this changeset.
              </p>
            ) : (
              <div className="space-y-3">
                {detail.items.map((item) => (
                  <ChangesetItemCard
                    key={item.id}
                    item={item}
                    expanded={expandedItemId === item.id}
                    onToggleExpand={() =>
                      setExpandedItemId(expandedItemId === item.id ? null : item.id)
                    }
                    onDecision={handleItemDecision}
                    disabled={actionLoading}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-eden-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-eden-bg text-eden-text
                       hover:bg-eden-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChangesetItemCard
// ---------------------------------------------------------------------------

const OPERATION_CONFIG: Record<ItemOperation, { color: string; bgColor: string; label: string }> = {
  add: { color: '#10b981', bgColor: 'bg-emerald-50', label: 'Add' },
  modify: { color: '#3b82f6', bgColor: 'bg-blue-50', label: 'Modify' },
  resolve: { color: '#f59e0b', bgColor: 'bg-amber-50', label: 'Resolve' },
};

const ITEM_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

function ChangesetItemCard({
  item,
  expanded,
  onToggleExpand,
  onDecision,
  disabled,
}: {
  item: ChangesetItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onDecision: (itemId: string, decision: 'accepted' | 'rejected') => void;
  disabled: boolean;
}) {
  const opConfig = OPERATION_CONFIG[item.operation as ItemOperation] ?? {
    color: '#6b7280',
    bgColor: 'bg-gray-50',
    label: item.operation,
  };

  const isPending = item.status === 'pending';

  return (
    <div className="border border-eden-border rounded-eden overflow-hidden">
      {/* Item header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-eden-surface cursor-pointer hover:bg-eden-bg/50 transition-colors"
        onClick={onToggleExpand}
      >
        {/* Operation icon */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${opConfig.bgColor}`}
        >
          <OperationIcon operation={item.operation as ItemOperation} color={opConfig.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: opConfig.color }}>
              {opConfig.label}
            </span>
            <span className="text-xs text-eden-text-2">
              {item.entity_type}
            </span>
            {item.display_reference && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-eden-bg text-eden-text-2 border border-eden-border">
                {item.display_reference}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-eden-text mt-0.5 truncate">
              {item.description}
            </p>
          )}
        </div>

        {/* Per-item actions or status */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {isPending ? (
            <>
              <button
                onClick={() => onDecision(item.id, 'accepted')}
                disabled={disabled}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                           text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                title="Accept"
              >
                <CheckIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDecision(item.id, 'rejected')}
                disabled={disabled}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                           text-red-700 bg-red-50 hover:bg-red-100 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reject"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ITEM_STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {item.status}
            </span>
          )}
        </div>

        {/* Expand chevron */}
        <ExpandChevron className={`w-4 h-4 text-eden-text-2 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Expanded diff view */}
      {expanded && (
        <div className="px-4 py-3 border-t border-eden-border bg-eden-bg/30">
          {item.operation === 'add' || !item.before_state ? (
            <div>
              <p className="text-xs font-medium text-eden-text-2 mb-2">Proposed state</p>
              <DiffBlock data={item.after_state} variant="add" />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-eden-text-2 mb-2">Before</p>
                <DiffBlock data={item.before_state} variant="remove" />
              </div>
              <div>
                <p className="text-xs font-medium text-eden-text-2 mb-2">After</p>
                <DiffBlock data={item.after_state} variant="add" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffBlock — renders JSON state in a styled pre block
// ---------------------------------------------------------------------------

function DiffBlock({ data, variant }: { data: any; variant: 'add' | 'remove' }) {
  if (data === null || data === undefined) {
    return (
      <p className="text-xs text-eden-text-2 italic">No data</p>
    );
  }

  const bg = variant === 'add' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200';
  const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <pre
      className={`text-xs font-mono text-eden-text p-3 rounded-lg border overflow-x-auto whitespace-pre-wrap break-words ${bg}`}
    >
      {formatted}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ItemsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-eden-border rounded-eden p-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ExpandChevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L10.94 10 7.22 6.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function OperationIcon({ operation, color }: { operation: ItemOperation; color: string }) {
  if (operation === 'add') {
    return (
      <svg width="16" height="16" viewBox="0 0 20 20" fill={color} aria-hidden="true">
        <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
      </svg>
    );
  }

  if (operation === 'modify') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }

  // resolve
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill={color} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}
