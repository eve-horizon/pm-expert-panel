import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ChangesetReviewModal } from '../components/changesets/ChangesetReviewModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Changeset {
  id: string;
  title: string;
  reasoning: string | null;
  source: string | null;
  status: string;
  created_at: string;
}

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

interface ChangesetDetail extends Changeset {
  items: ChangesetItem[];
}

type ChangesetStatus = 'draft' | 'accepted' | 'rejected' | 'partial';

type TabKey = 'all' | 'draft' | 'accepted' | 'rejected';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

// ---------------------------------------------------------------------------
// ChangesetsPage
// ---------------------------------------------------------------------------

export function ChangesetsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [changesets, setChangesets] = useState<Changeset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // Review modal
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState<ChangesetDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchChangesets = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab !== 'all' ? `?status=${activeTab}` : '';
      const data = await api.get<Changeset[]>(
        `/projects/${projectId}/changesets${statusParam}`,
      );
      setChangesets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changesets');
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTab]);

  useEffect(() => {
    fetchChangesets();
  }, [fetchChangesets]);

  // Fetch detail when opening the review modal
  const openReview = useCallback(async (id: string) => {
    setReviewId(id);
    setReviewLoading(true);
    try {
      const detail = await api.get<ChangesetDetail>(`/changesets/${id}`);
      setReviewDetail(detail);
    } catch {
      setReviewDetail(null);
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const refreshReview = useCallback(async () => {
    if (!reviewId) return;
    try {
      const detail = await api.get<ChangesetDetail>(`/changesets/${reviewId}`);
      setReviewDetail(detail);
    } catch {
      // keep current state if refresh fails
    }
    // Also refresh the list so counts stay accurate
    fetchChangesets();
  }, [reviewId, fetchChangesets]);

  const closeReview = () => {
    setReviewId(null);
    setReviewDetail(null);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-eden-text">Changes</h2>
          <p className="text-sm text-eden-text-2 mt-1">
            Review proposed changes from AI analysis and source ingestion.
          </p>
        </div>
      </div>

      {/* Tab filters */}
      <div className="flex items-center gap-1 mb-6 border-b border-eden-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative
              ${
                activeTab === key
                  ? 'text-eden-accent'
                  : 'text-eden-text-2 hover:text-eden-text'
              }`}
          >
            {label}
            {activeTab === key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-eden-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CardSkeleton />
      ) : changesets.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="space-y-3">
          {changesets.map((cs) => (
            <ChangesetCard
              key={cs.id}
              changeset={cs}
              onReview={() => openReview(cs.id)}
            />
          ))}
        </div>
      )}

      {/* Review modal */}
      {reviewId && (
        <ChangesetReviewModal
          detail={reviewDetail}
          loading={reviewLoading}
          onClose={closeReview}
          onRefresh={refreshReview}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChangesetCard
// ---------------------------------------------------------------------------

function ChangesetCard({
  changeset: cs,
  onReview,
}: {
  changeset: Changeset;
  onReview: () => void;
}) {
  return (
    <button
      onClick={onReview}
      className="w-full text-left bg-eden-surface border border-eden-border rounded-eden p-5
                 hover:border-eden-accent/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-sm font-semibold text-eden-text truncate">
              {cs.title}
            </h3>
            <ChangesetStatusBadge status={cs.status as ChangesetStatus} />
          </div>

          <div className="flex items-center gap-4 text-xs text-eden-text-2">
            {cs.source && (
              <span className="flex items-center gap-1.5">
                <SourceIcon className="w-3.5 h-3.5" />
                {cs.source}
              </span>
            )}
            <span>{formatDate(cs.created_at)}</span>
          </div>
        </div>

        <ChevronRightIcon className="w-5 h-5 text-eden-text-2 flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const CHANGESET_STATUS_STYLES: Record<ChangesetStatus, string> = {
  draft: 'bg-blue-100 text-blue-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-800',
};

function ChangesetStatusBadge({ status }: { status: ChangesetStatus }) {
  const style = CHANGESET_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  const label = status === 'draft' ? 'pending' : status;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${style}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Empty state & skeleton
// ---------------------------------------------------------------------------

function EmptyState({ activeTab }: { activeTab: TabKey }) {
  const messages: Record<TabKey, string> = {
    all: 'No changesets yet. They will appear here when AI analysis produces proposed changes.',
    draft: 'No pending changesets awaiting review.',
    accepted: 'No accepted changesets.',
    rejected: 'No rejected changesets.',
  };

  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-eden-surface border border-eden-border mb-4">
        <ChangesIcon className="w-6 h-6 text-eden-text-2" />
      </div>
      <p className="text-sm text-eden-text-2">{messages[activeTab]}</p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-eden-surface border border-eden-border rounded-eden p-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

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

function ChevronRightIcon({ className }: { className?: string }) {
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

function ChangesIcon({ className }: { className?: string }) {
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
      <path d="M12 3v18" />
      <path d="M8 7l4-4 4 4" />
      <path d="M4 11h16" />
      <path d="M4 15h16" />
      <path d="M4 19h16" />
    </svg>
  );
}
