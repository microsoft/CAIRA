import type { ActivityMessage } from '../types.ts';

interface MessageBubbleProps {
  readonly message: ActivityMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`max-w-[75%] rounded-lg px-4 py-3 break-words ${
        isUser ? 'self-end rounded-br-sm bg-indigo-600/80' : 'self-start rounded-bl-sm bg-zinc-800'
      }`}
      data-testid={`message-${message.id}`}
      data-role={message.role}
    >
      <div className='mb-1 text-[0.7rem] font-medium tracking-wide text-zinc-400 uppercase'>
        {isUser ? 'You' : 'Assistant'}
      </div>
      <div className='whitespace-pre-wrap text-[0.95rem] leading-relaxed text-zinc-200'>{message.content}</div>
      <div className='mt-1 text-right text-[0.65rem] text-zinc-500'>
        {new Date(message.createdAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
