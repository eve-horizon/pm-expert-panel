import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity, Persona } from './types';

// ---------------------------------------------------------------------------
// MiniMap — bird's-eye navigation overlay for the story map grid
//
// Fixed bottom-right panel showing a miniature representation of the entire
// grid. Click to scroll the main container; a viewport indicator tracks the
// current scroll position. Collapsible header. Hidden in print.
// ---------------------------------------------------------------------------

interface MiniMapProps {
  activities: Activity[];
  personas: Persona[];
  containerRef: React.RefObject<HTMLDivElement>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  selectedActivities?: Set<string>;
  roleHighlight?: string | null;
  hideProposed?: boolean;
}

const MINIMAP_WIDTH = 300;
const HEADER_HEIGHT = 32;
const ACTIVITY_BAR_HEIGHT = 14;
const STEP_BAR_HEIGHT = 2;
const TASK_BAR_HEIGHT = 3;
const GAP = 2;

export function MiniMap({
  activities,
  personas,
  containerRef,
  collapsed = false,
  onToggleCollapse,
  selectedActivities,
  roleHighlight,
  hideProposed = false,
}: MiniMapProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Build a persona color lookup
  const personaColorMap = new Map<string, string>();
  for (const p of personas) {
    personaColorMap.set(p.id, p.color);
  }

  // Calculate total minimap body height
  let totalHeight = 0;
  for (const activity of activities) {
    totalHeight += ACTIVITY_BAR_HEIGHT + GAP;
    for (const step of activity.steps) {
      totalHeight += STEP_BAR_HEIGHT + GAP;
      const tasks = hideProposed
        ? step.tasks.filter((t) => (t.lifecycle ?? 'current') !== 'proposed')
        : step.tasks;
      totalHeight += tasks.length * (TASK_BAR_HEIGHT + 1);
    }
    totalHeight += GAP;
  }
  totalHeight = Math.max(totalHeight, 40);

  // Track container scroll to update viewport indicator
  const updateViewport = useCallback(() => {
    const el = containerRef.current;
    if (!el || !bodyRef.current) return;

    const bodyW = bodyRef.current.clientWidth;
    const bodyH = bodyRef.current.clientHeight;

    const scaleX = bodyW / el.scrollWidth;
    const scaleY = bodyH / el.scrollHeight;

    setViewport({
      x: el.scrollLeft * scaleX,
      y: el.scrollTop * scaleY,
      w: el.clientWidth * scaleX,
      h: el.clientHeight * scaleY,
    });
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateViewport();
    el.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);

    return () => {
      el.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [containerRef, updateViewport]);

  // Click in minimap body -> scroll the container proportionally
  const handleBodyClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      const body = bodyRef.current;
      if (!el || !body) return;

      const rect = body.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const ratioX = clickX / rect.width;
      const ratioY = clickY / rect.height;

      el.scrollTo({
        left: ratioX * el.scrollWidth - el.clientWidth / 2,
        top: ratioY * el.scrollHeight - el.clientHeight / 2,
        behavior: 'smooth',
      });
    },
    [containerRef],
  );

  return (
    <div
      className="minimap fixed bottom-4 right-4 z-50 rounded-lg shadow-lg overflow-hidden print:hidden"
      style={{ width: MINIMAP_WIDTH }}
    >
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-between w-full px-3 text-[11px] font-semibold text-white/90 cursor-pointer select-none"
        style={{ backgroundColor: '#1a1a2e', height: HEADER_HEIGHT }}
      >
        <span>Mini-Map</span>
        <ChevronMiniIcon
          className={`w-3.5 h-3.5 transition-transform duration-150 ${
            collapsed ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Body */}
      {!collapsed && (
        <div
          ref={bodyRef}
          className="relative cursor-crosshair"
          style={{
            backgroundColor: '#f8f9fa',
            height: Math.min(totalHeight + 8, 200),
            padding: 4,
          }}
          onClick={handleBodyClick}
        >
          {/* Viewport indicator */}
          <div
            className="absolute border-2 border-orange-400 rounded-sm pointer-events-none"
            style={{
              left: viewport.x,
              top: viewport.y,
              width: Math.max(viewport.w, 8),
              height: Math.max(viewport.h, 4),
              backgroundColor: 'rgba(251,146,60,0.15)',
            }}
          />

          {/* Miniature grid */}
          {activities.map((activity) => {
            const isDimmed =
              selectedActivities != null && !selectedActivities.has(activity.id);

            return (
              <div
                key={activity.id}
                className="mb-1"
                style={{ opacity: isDimmed ? 0.15 : 1 }}
              >
                {/* Activity label bar */}
                <div
                  className="rounded-sm mb-px overflow-hidden text-ellipsis whitespace-nowrap px-1 text-[7px] font-bold text-white/80"
                  style={{
                    backgroundColor: '#1e293b',
                    height: ACTIVITY_BAR_HEIGHT,
                    lineHeight: `${ACTIVITY_BAR_HEIGHT}px`,
                  }}
                >
                  {activity.display_id} {activity.name}
                </div>

                {/* Steps + tasks */}
                {activity.steps.map((step) => {
                  const tasks = hideProposed
                    ? step.tasks.filter(
                        (t) => (t.lifecycle ?? 'current') !== 'proposed',
                      )
                    : step.tasks;

                  return (
                    <div key={step.id} className="ml-1 mb-px">
                      {/* Step accent bar */}
                      <div
                        className="rounded-sm"
                        style={{
                          height: STEP_BAR_HEIGHT,
                          backgroundColor: '#f59e0b',
                          opacity: 0.6,
                        }}
                      />

                      {/* Task bars */}
                      {tasks.map((task) => {
                        const lifecycle = task.lifecycle ?? 'current';
                        const isDiscontinued = lifecycle === 'discontinued';
                        const isProposed = lifecycle === 'proposed';
                        const dimmedByRole =
                          roleHighlight != null &&
                          task.persona?.code !== roleHighlight;

                        let barColor = task.persona?.color ?? '#9ca3af';
                        if (isProposed) barColor = '#10b981';
                        if (isDiscontinued) barColor = '#9ca3af';

                        return (
                          <div
                            key={task.id}
                            className="rounded-sm mt-px"
                            style={{
                              height: TASK_BAR_HEIGHT,
                              backgroundColor: barColor,
                              opacity: isDiscontinued
                                ? 0.3
                                : dimmedByRole
                                  ? 0.2
                                  : 0.8,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icon
// ---------------------------------------------------------------------------

function ChevronMiniIcon({ className }: { className?: string }) {
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
