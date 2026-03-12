import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Source {
  id: string;
  filename: string;
  content_type: string;
  status: string;
  file_size: number | null;
  created_at: string;
  upload_url?: string;
}

type SourceStatus = 'uploaded' | 'processing' | 'extracted' | 'synthesized' | 'failed';

// ---------------------------------------------------------------------------
// SourcesPage
// ---------------------------------------------------------------------------

export function SourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSources = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Source[]>(`/projects/${projectId}/sources`);
      setSources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleUpload = async (file: File) => {
    if (!projectId) return;
    setUploading(true);
    setError(null);
    try {
      // Create the source record
      const source = await api.post<Source>(`/projects/${projectId}/sources`, {
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
      });

      // Confirm to transition to processing
      await api.post(`/sources/${source.id}/confirm`);

      // Refresh list
      fetchSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-eden-text">Sources</h2>
        <p className="text-sm text-eden-text-2 mt-1">
          Upload documents for AI analysis. Extracted requirements appear as
          changesets.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 border-2 border-dashed rounded-eden p-8 text-center cursor-pointer transition-colors
          ${
            dragOver
              ? 'border-eden-accent bg-eden-accent/5'
              : 'border-eden-border hover:border-eden-accent/40 hover:bg-eden-bg/50'
          }
          ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-eden-surface border border-eden-border flex items-center justify-center">
            <UploadIcon className="w-6 h-6 text-eden-text-2" />
          </div>
          {uploading ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-eden-text">Processing...</p>
              <p className="text-xs text-eden-text-2">
                Creating source record
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-eden-text">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-eden-text-2">
                PDF, Word, Markdown, CSV, Excel, or images
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Source list */}
      {loading ? (
        <ListSkeleton />
      ) : sources.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-eden-surface rounded-eden border border-eden-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-eden-border bg-eden-bg/50">
                <th className="text-left px-4 py-3 font-medium text-eden-text-2">
                  File
                </th>
                <th className="text-left px-4 py-3 font-medium text-eden-text-2 w-28">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-eden-text-2 w-28">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-eden-text-2 w-24">
                  Size
                </th>
                <th className="text-right px-4 py-3 font-medium text-eden-text-2 w-32">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceRow
// ---------------------------------------------------------------------------

function SourceRow({ source }: { source: Source }) {
  return (
    <tr className="border-b border-eden-border last:border-0 hover:bg-eden-bg/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileTypeIcon contentType={source.content_type} />
          <span className="text-eden-text font-medium truncate max-w-xs">
            {source.filename}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-eden-text-2 font-mono">
        {shortContentType(source.content_type)}
      </td>
      <td className="px-4 py-3">
        <SourceStatusBadge status={source.status as SourceStatus} />
      </td>
      <td className="px-4 py-3 text-right text-xs text-eden-text-2 font-mono">
        {source.file_size != null ? formatSize(source.file_size) : '--'}
      </td>
      <td className="px-4 py-3 text-right text-xs text-eden-text-2">
        {formatDate(source.created_at)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const SOURCE_STATUS_STYLES: Record<SourceStatus, string> = {
  uploaded: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-800',
  extracted: 'bg-amber-100 text-amber-800',
  synthesized: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const style = SOURCE_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortContentType(ct: string): string {
  // Show just the subtype for common MIME types
  const parts = ct.split('/');
  const sub = parts[1];
  if (!sub) return ct;
  return sub.replace('vnd.openxmlformats-officedocument.', '').replace('wordprocessingml.document', 'docx').replace('spreadsheetml.sheet', 'xlsx');
}

// ---------------------------------------------------------------------------
// Empty state & skeleton
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-eden-surface border border-eden-border mb-4">
        <UploadIcon className="w-6 h-6 text-eden-text-2" />
      </div>
      <p className="text-sm text-eden-text-2">
        No sources uploaded. Drop a file above to get started.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="bg-eden-surface rounded-eden border border-eden-border overflow-hidden">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-eden-border last:border-0"
        >
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function UploadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  // Simple heuristic for file icon color
  const isPdf = contentType.includes('pdf');
  const isImage = contentType.startsWith('image/');
  const isSpreadsheet = contentType.includes('sheet') || contentType.includes('csv');

  let color = 'text-eden-text-2';
  if (isPdf) color = 'text-red-500';
  else if (isImage) color = 'text-purple-500';
  else if (isSpreadsheet) color = 'text-emerald-500';

  return (
    <svg
      className={`w-5 h-5 flex-shrink-0 ${color}`}
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
