// ---------------------------------------------------------------------------
// AnswerProgress — progress bar showing answered vs total questions
//
// Displays a thin rounded bar with eden-green fill and a compact text label.
// Used in the cross-cutting panel, question modal, and map legend.
// ---------------------------------------------------------------------------

interface AnswerProgressProps {
  answered: number;
  total: number;
}

export function AnswerProgress({ answered, total }: AnswerProgressProps) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-eden-green rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-eden-text-2 whitespace-nowrap">
        {answered}/{total} ({pct}%)
      </span>
    </div>
  );
}
