// ---------------------------------------------------------------------------
// EvolvedBadge — green pill indicating an entity was AI-modified
//
// Appears next to display IDs on tasks/steps that were changed by the
// evolution pipeline. Renders nothing when invisible or count is zero.
// ---------------------------------------------------------------------------

interface EvolvedBadgeProps {
  visible: boolean;
  count: number;
  onClick?: () => void;
}

export function EvolvedBadge({ visible, count, onClick }: EvolvedBadgeProps) {
  if (!visible || count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                 transition-colors hover:opacity-80"
      style={{
        background: 'rgba(16,185,129,0.15)',
        color: '#10b981',
      }}
      data-testid="evolved-badge"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      EVOLVED
      {count > 1 && (
        <span className="text-[10px] opacity-70">({count})</span>
      )}
    </button>
  );
}
