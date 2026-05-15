import { useEffect, useRef } from 'react';
import type { ActivityOutcome, ActivityMessage } from '../types.ts';
import { MessageBubble } from './MessageBubble.tsx';
import { OutcomeCard } from './OutcomeCard.tsx';

/** Map specialist tool names to human-readable labels. */
const SPECIALIST_LABELS: Record<string, string> = {
  discovery_specialist: 'The discovery specialist',
  planning_specialist: 'The account planning specialist',
  staffing_specialist: 'The staffing specialist'
};

interface ChatAreaProps {
  readonly messages: readonly ActivityMessage[];
  readonly streamingContent: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly outcome?: ActivityOutcome | null | undefined;
  readonly activeSpecialist?: string | null | undefined;
}

export function ChatArea({ messages, streamingContent, isLoading, error, outcome, activeSpecialist }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, outcome]);

  if (error) {
    return (
      <div className='flex flex-1 flex-col overflow-y-auto p-5' data-testid='chat-area'>
        <div
          className='my-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400'
          data-testid='chat-area-error'
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col overflow-y-auto p-5' data-testid='chat-area'>
      {messages.length === 0 && !isLoading && !streamingContent && (
        <div className='flex flex-1 items-center justify-center text-zinc-500 italic' data-testid='chat-area-empty'>
          Pick an activity to begin a sales/account-team scenario.
        </div>
      )}

      <div className='flex flex-col gap-3'>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streamingContent && (
          <div
            className='max-w-[75%] self-start rounded-lg rounded-bl-sm bg-zinc-800 px-4 py-3 opacity-90'
            data-testid='streaming-message'
          >
            <div className='mb-1 text-[0.7rem] font-medium tracking-wide text-indigo-400 uppercase'>Coordinator</div>
            <div className='whitespace-pre-wrap text-[0.95rem] leading-relaxed text-zinc-200'>{streamingContent}</div>
          </div>
        )}

        {outcome && <OutcomeCard outcome={outcome} />}

        {isLoading && !streamingContent && (
          <div className='py-2 text-sm text-zinc-500 italic' data-testid='chat-area-loading'>
            {activeSpecialist
              ? `${SPECIALIST_LABELS[activeSpecialist] ?? activeSpecialist} is working...`
              : 'The coordinator is thinking...'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
