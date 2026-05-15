import type { ActivityConversation, ActivityMode } from '../types.ts';

interface ConversationListProps {
  readonly conversations: readonly ActivityConversation[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly isLoading: boolean;
}

const MODE_LABELS: Record<ActivityMode, string> = {
  discovery: 'Discovery',
  planning: 'Account Plan',
  staffing: 'Staffing'
};

const MODE_COLORS: Record<ActivityMode, string> = {
  discovery: 'bg-amber-500/20 text-amber-400',
  planning: 'bg-emerald-500/20 text-emerald-400',
  staffing: 'bg-sky-500/20 text-sky-400'
};

/** Format an ISO timestamp as a relative time string (e.g., "2 min ago"). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ConversationList({ conversations, selectedId, onSelect, isLoading }: ConversationListProps) {
  return (
    <aside
      className='flex w-72 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-900'
      data-testid='conversation-list'
    >
      <div className='border-b border-zinc-800 px-4 py-3'>
        <h2 className='text-sm font-medium tracking-widest text-zinc-400 uppercase'>Activities</h2>
      </div>

      {isLoading && conversations.length === 0 && (
        <div className='p-5 text-center text-sm text-zinc-500 italic' data-testid='conversation-list-loading'>
          Loading activities...
        </div>
      )}

      <ul className='list-none'>
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={`border-b border-zinc-800 ${conversation.id === selectedId ? 'border-l-2 border-l-indigo-500 bg-zinc-800/50' : ''}`}
            data-testid={`conversation-item-${conversation.id}`}
          >
            <button
              className='flex w-full cursor-pointer flex-col gap-1 border-none bg-transparent px-4 py-3 text-left text-zinc-200 transition-colors hover:bg-zinc-800/50'
              onClick={() => onSelect(conversation.id)}
            >
              <div className='flex items-center gap-2'>
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase ${MODE_COLORS[conversation.mode]}`}
                  data-testid={`mode-badge-${conversation.id}`}
                >
                  {MODE_LABELS[conversation.mode]}
                </span>
                {conversation.status === 'resolved' && (
                  <span
                    className='rounded-sm bg-indigo-500/20 px-1.5 py-0.5 text-[0.65rem] font-semibold text-indigo-400 uppercase'
                    data-testid={`status-badge-${conversation.id}`}
                  >
                    Resolved
                  </span>
                )}
              </div>
              <span className='text-xs text-zinc-500'>{relativeTime(conversation.lastMessageAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
