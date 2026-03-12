import type { Step } from './types';

// ---------------------------------------------------------------------------
// StepHeader — orange accent column header for a step within an activity
//
// Matches prototype: solid orange (#e65100) background with white text,
// optional persona-colored 4px left border, display_id + name inline.
// ---------------------------------------------------------------------------

interface StepHeaderProps {
  step: Step;
  /** Color of the primary persona (first task's persona) — shown as a 4px left border. */
  primaryPersonaColor?: string | null;
}

export function StepHeader({ step, primaryPersonaColor }: StepHeaderProps) {
  return (
    <div
      style={{
        backgroundColor: '#e65100',
        color: '#fff',
        padding: '9px 14px',
        fontSize: '11px',
        fontWeight: 600,
        borderRight: '1px solid rgba(255,255,255,0.15)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        borderLeft: primaryPersonaColor
          ? `4px solid ${primaryPersonaColor}`
          : '4px solid transparent',
      }}
    >
      <span
        style={{
          fontSize: '8px',
          fontWeight: 500,
          opacity: 0.5,
          marginRight: '5px',
        }}
      >
        {step.display_id}
      </span>
      {step.name}
    </div>
  );
}
