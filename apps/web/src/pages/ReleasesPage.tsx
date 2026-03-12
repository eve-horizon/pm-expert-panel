import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Release {
  id: string;
  name: string;
  target_date: string | null;
  status: string;
  task_count?: number;
  created_at: string;
  updated_at: string;
}

interface ReleaseTask {
  id: string;
  display_id: string;
  title: string;
  role: string | null;
  priority: string | null;
}

type ReleaseStatus = 'planning' | 'active' | 'released';

// ---------------------------------------------------------------------------
// ReleasesPage
// ---------------------------------------------------------------------------

export function ReleasesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Detail view
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [releaseTasks, setReleaseTasks] = useState<ReleaseTask[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchReleases = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Release[]>(
        `/projects/${projectId}/releases`,
      );
      setReleases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const selectRelease = useCallback(async (release: Release) => {
    if (selectedRelease?.id === release.id) {
      setSelectedRelease(null);
      setReleaseTasks([]);
      return;
    }
    setSelectedRelease(release);
    setDetailLoading(true);
    try {
      const tasks = await api.get<ReleaseTask[]>(`/releases/${release.id}/tasks`);
      setReleaseTasks(tasks);
    } catch {
      setReleaseTasks([]);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedRelease]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-eden-text">Releases</h2>
          <p className="text-sm text-eden-text-2 mt-1">
            Plan releases, set target dates, and track progress.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="eden-btn-primary"
        >
          <PlusIcon className="w-4 h-4" />
          New Release
        </button>
      </div>

      {/* Inline create */}
      {showCreate && projectId && (
        <CreateReleaseForm
          projectId={projectId}
          onCreate={() => {
            setShowCreate(false);
            fetchReleases();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CardSkeleton />
      ) : releases.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {releases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              selected={selectedRelease?.id === release.id}
              onClick={() => selectRelease(release)}
            />
          ))}
        </div>
      )}

      {/* Release detail panel */}
      {selectedRelease && (
        <ReleaseDetailPanel
          release={selectedRelease}
          tasks={releaseTasks}
          loading={detailLoading}
          onClose={() => { setSelectedRelease(null); setReleaseTasks([]); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReleaseCard
// ---------------------------------------------------------------------------

function ReleaseCard({
  release,
  selected,
  onClick,
}: {
  release: Release;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-lg shadow-sm border p-5 transition-all
        ${selected ? 'border-eden-accent ring-2 ring-eden-accent/20' : 'border-gray-200 hover:border-eden-accent/40 hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-semibold text-eden-text">
          {release.name}
        </h3>
        <ReleaseStatusBadge status={release.status as ReleaseStatus} />
      </div>

      <div className="space-y-2 text-sm text-eden-text-2">
        {release.target_date ? (
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-eden-text-2" />
            <span>{formatDate(release.target_date)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-gray-300" />
            <span className="text-gray-400">No target date</span>
          </div>
        )}

        {release.task_count != null && (
          <div className="flex items-center gap-2">
            <TaskIcon className="w-4 h-4 text-eden-text-2" />
            <span>{release.task_count} task{release.task_count !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ReleaseDetailPanel — task assignments
// ---------------------------------------------------------------------------

function ReleaseDetailPanel({
  release,
  tasks,
  loading,
  onClose,
}: {
  release: Release;
  tasks: ReleaseTask[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mt-6 bg-eden-surface rounded-eden border border-eden-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-eden-border bg-eden-bg/30">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-eden-text">{release.name}</h3>
          <ReleaseStatusBadge status={release.status as ReleaseStatus} />
          {release.target_date && (
            <span className="text-xs text-eden-text-2">
              Target: {formatDate(release.target_date)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-eden-text-2 hover:text-eden-text transition-colors"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tasks */}
      <div className="px-5 py-4">
        <h4 className="text-[10px] font-medium text-eden-text-2 uppercase tracking-wider mb-3">
          Tasks in this release ({tasks.length})
        </h4>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-eden-text-2 italic">
            No tasks assigned to this release yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-eden-border px-3 py-2.5"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold flex-shrink-0">
                  T
                </span>
                <span className="text-[10px] font-mono text-eden-text-2 flex-shrink-0">
                  {task.display_id}
                </span>
                <span className="text-xs text-eden-text truncate flex-1">
                  {task.title}
                </span>
                {task.priority && (
                  <PriorityBadge priority={task.priority} />
                )}
                {task.role && (
                  <span className="text-[10px] text-eden-text-2 bg-eden-bg px-1.5 py-0.5 rounded flex-shrink-0">
                    {task.role}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    must: 'bg-red-100 text-red-700',
    should: 'bg-amber-100 text-amber-700',
    could: 'bg-blue-100 text-blue-700',
    wont: 'bg-gray-100 text-gray-500',
  };
  const style = styles[priority] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase flex-shrink-0 ${style}`}>
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CreateReleaseForm
// ---------------------------------------------------------------------------

function CreateReleaseForm({
  projectId,
  onCreate,
  onCancel,
}: {
  projectId: string;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState('planning');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/releases`, {
        name: name.trim(),
        target_date: targetDate || undefined,
        status,
      });
      onCreate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create release',
      );
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="eden-card p-5 mb-4">
      <h3 className="text-sm font-semibold text-eden-text mb-4">
        Create a new release
      </h3>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label
            htmlFor="release-name"
            className="block text-xs font-medium text-eden-text mb-1"
          >
            Name
          </label>
          <input
            id="release-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="v1.0"
            autoFocus
            className="w-full rounded-lg border border-eden-border bg-eden-surface
                       px-3 py-2 text-sm text-eden-text placeholder:text-eden-text-2
                       focus:outline-none focus:ring-2 focus:ring-eden-accent/30 focus:border-eden-accent
                       transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="release-date"
            className="block text-xs font-medium text-eden-text mb-1"
          >
            Target Date
          </label>
          <input
            id="release-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-lg border border-eden-border bg-eden-surface
                       px-3 py-2 text-sm text-eden-text
                       focus:outline-none focus:ring-2 focus:ring-eden-accent/30 focus:border-eden-accent
                       transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="release-status"
            className="block text-xs font-medium text-eden-text mb-1"
          >
            Status
          </label>
          <select
            id="release-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-eden-border bg-eden-surface px-3 py-2 text-sm text-eden-text
                       focus:outline-none focus:ring-2 focus:ring-eden-accent/30 focus:border-eden-accent"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="released">Released</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="eden-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create Release'}
        </button>
        <button type="button" onClick={onCancel} className="eden-btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const RELEASE_STATUS_STYLES: Record<ReleaseStatus, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-800',
  released: 'bg-emerald-100 text-emerald-800',
};

function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  const style = RELEASE_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}
    >
      {status}
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

function EmptyState() {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-eden-text-2">
        No releases yet. Create one to start planning.
      </p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
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
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
