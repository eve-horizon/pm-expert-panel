import type { Persona } from './types';

// ---------------------------------------------------------------------------
// PersonaTabs — sticky tab bar for server-side persona filtering
//
// "Overview" shows all tasks with a total task count. Each persona tab
// displays: persona name + colored dot (8px circle) + task count badge.
// Active tab: bottom border in persona color (3px) instead of filled bg.
// ---------------------------------------------------------------------------

interface PersonaTabsProps {
  personas: Persona[];
  active: string | null; // null = overview (all)
  onSelect: (personaCode: string | null) => void;
  /** Task counts keyed by persona code — used for count badges */
  personaCounts?: Record<string, number>;
  /** Total task count across all personas — shown on Overview tab */
  totalTaskCount?: number;
}

export function PersonaTabs({
  personas,
  active,
  onSelect,
  personaCounts = {},
  totalTaskCount,
}: PersonaTabsProps) {
  return (
    <div className="sticky top-0 z-30 bg-eden-bg border-b border-eden-border">
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto eden-scroll">
        {/* Overview tab */}
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${
              active === null
                ? 'text-eden-text bg-white shadow-sm'
                : 'text-eden-text-2 hover:bg-white hover:text-eden-text'
            }`}
          style={
            active === null
              ? { borderBottom: '3px solid #6366f1' }
              : undefined
          }
        >
          Overview
          {totalTaskCount != null && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gray-200 text-[10px] font-bold text-eden-text">
              {totalTaskCount}
            </span>
          )}
        </button>

        {/* Per-persona tabs */}
        {personas.map((p) => {
          const isActive = active === p.code;
          const count = personaCounts[p.code];
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.code)}
              className={`flex-shrink-0 relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'text-eden-text bg-white shadow-sm'
                    : 'text-eden-text-2 hover:bg-white hover:text-eden-text'
                }`}
              style={
                isActive
                  ? { borderBottom: `3px solid ${p.color}` }
                  : undefined
              }
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
              {count != null && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
