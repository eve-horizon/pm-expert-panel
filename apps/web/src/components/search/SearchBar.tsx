import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  entity_type: string;
  display_id: string;
  title: string;
  excerpt: string;
}

interface SearchBarProps {
  projectId: string;
  onResultClick: (displayId: string) => void;
}

// ---------------------------------------------------------------------------
// SearchBar
// ---------------------------------------------------------------------------

export function SearchBar({ projectId, onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const data = await api.get<SearchResult[]>(
            `/projects/${projectId}/search?q=${encodeURIComponent(q)}`,
          );
          setResults(data);
          setOpen(data.length > 0);
        } catch {
          setResults([]);
          setOpen(false);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [projectId],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleResultClick = (displayId: string) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    onResultClick(displayId);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Input */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-eden-text-2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search map..."
          className="w-52 pl-8 pr-3 py-1.5 rounded-lg border border-eden-border bg-eden-bg/60
                     text-xs text-eden-text placeholder:text-eden-text-2
                     focus:outline-none focus:ring-2 focus:ring-eden-accent/30 focus:border-eden-accent
                     transition-colors"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-eden-accent/30 border-t-eden-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-72 overflow-y-auto
                        rounded-eden bg-eden-surface shadow-modal border border-eden-border z-50">
          {results.map((r) => (
            <button
              key={r.display_id}
              onClick={() => handleResultClick(r.display_id)}
              className="w-full text-left px-3 py-2.5 hover:bg-eden-bg transition-colors
                         border-b border-eden-border last:border-0"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <EntityTypeIcon type={r.entity_type} />
                <span className="text-[10px] font-mono text-eden-text-2">
                  {r.display_id}
                </span>
                <span className="text-xs font-medium text-eden-text truncate">
                  {r.title}
                </span>
              </div>
              {r.excerpt && (
                <p className="text-[11px] text-eden-text-2 line-clamp-2 ml-6">
                  {r.excerpt}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity type icon — small colored badge per entity type
// ---------------------------------------------------------------------------

function EntityTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    activity: 'bg-indigo-100 text-indigo-700',
    step: 'bg-orange-100 text-orange-700',
    task: 'bg-emerald-100 text-emerald-700',
    question: 'bg-amber-100 text-amber-700',
  };

  const style = colors[type] ?? 'bg-gray-100 text-gray-600';
  const letter = type.charAt(0).toUpperCase();

  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold flex-shrink-0 ${style}`}
    >
      {letter}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG
// ---------------------------------------------------------------------------

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
