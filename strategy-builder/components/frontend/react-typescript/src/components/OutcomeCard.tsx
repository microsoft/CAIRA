import type { ActivityOutcome } from '../types.ts';

interface OutcomeCardProps {
  readonly outcome: ActivityOutcome;
}

const MODE_LABELS: Record<string, string> = {
  resolve_discovery: 'Discovery Summary',
  resolve_planning: 'Account Plan Summary',
  resolve_staffing: 'Staffing Recommendation'
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  resolve_discovery: {
    fit: 'Disposition',
    signals_reviewed: 'Signals reviewed',
    primary_need: 'Key insight'
  },
  resolve_planning: {
    approved: 'Advance',
    focus_area: 'Focus area',
    next_step: 'Next step'
  },
  resolve_staffing: {
    coverage_level: 'Coverage level',
    role: 'Recommended role',
    team_name: 'Team name'
  }
};

export function OutcomeCard({ outcome }: OutcomeCardProps) {
  const title = MODE_LABELS[outcome.tool] ?? 'Activity Summary';

  return (
    <div
      className='mx-auto my-4 w-full max-w-md rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4'
      data-testid='outcome-card'
    >
      <div className='mb-2 text-center text-sm font-semibold tracking-wide text-indigo-400 uppercase'>{title}</div>
      <dl className='flex flex-col gap-1.5' data-testid='outcome-details'>
        {Object.entries(outcome.result).map(([key, value]) => (
          <div key={key} className='flex justify-between gap-4 text-sm'>
            <dt className='font-medium capitalize text-zinc-400'>
              {FIELD_LABELS[outcome.tool]?.[key] ?? key.replace(/_/g, ' ')}
            </dt>
            <dd className='text-right text-zinc-200'>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
