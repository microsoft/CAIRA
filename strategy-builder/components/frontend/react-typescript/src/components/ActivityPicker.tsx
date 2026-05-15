import type { ActivityMode } from '../types.ts';

interface ActivityPickerProps {
  readonly onStart: (mode: ActivityMode) => void;
  readonly disabled?: boolean | undefined;
  /** When set, shows a spinner + "Starting..." on that button and disables all buttons. */
  readonly loadingMode?: ActivityMode | null | undefined;
}

const ACTIVITIES: { mode: ActivityMode; label: string; description: string }[] = [
  { mode: 'discovery', label: 'Opportunity Discovery', description: 'Qualify a new customer opportunity' },
  { mode: 'planning', label: 'Account Planning', description: 'Shape the next account-team engagement plan' },
  { mode: 'staffing', label: 'Team Staffing', description: 'Assign the right role and coverage plan' }
];

export function ActivityPicker({ onStart, disabled = false, loadingMode = null }: ActivityPickerProps) {
  const isAnyLoading = loadingMode != null;

  return (
    <div className='flex flex-col gap-1.5 border-b border-zinc-800 px-3 py-3' data-testid='activity-picker'>
      {ACTIVITIES.map(({ mode, label, description }) => {
        const isThisLoading = loadingMode === mode;
        return (
          <button
            key={mode}
            className='cursor-pointer rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-left transition-colors hover:border-indigo-500/50 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => onStart(mode)}
            disabled={disabled || isAnyLoading}
            data-testid={`activity-btn-${mode}`}
          >
            {isThisLoading ? (
              <div className='flex items-center gap-2' data-testid={`activity-loading-${mode}`}>
                <svg
                  className='h-4 w-4 animate-spin text-indigo-400'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                  <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
                </svg>
                <span className='text-sm font-medium text-zinc-400'>Starting...</span>
              </div>
            ) : (
              <>
                <div className='text-sm font-medium text-zinc-200'>{label}</div>
                <div className='text-xs text-zinc-500'>{description}</div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
