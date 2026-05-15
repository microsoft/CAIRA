import { useEffect, useMemo, useState } from 'react';
import { ActivityClient } from './api/activity-client.ts';
import { ActivityPicker } from './components/ActivityPicker.tsx';
import { ConversationList } from './components/ConversationList.tsx';
import { ChatArea } from './components/ChatArea.tsx';
import { MessageInput } from './components/MessageInput.tsx';
import { StreamToggle } from './components/StreamToggle.tsx';
import { useActivityConversations } from './hooks/useActivityConversations.ts';
import { useConversationStates } from './hooks/useConversationStates.ts';
import { useChat } from './hooks/useChat.ts';
import './styles/index.css';

export function App() {
  const client = useMemo(
    () =>
      new ActivityClient({
        baseUrl: import.meta.env['VITE_API_BASE_URL'] ?? '/api'
      }),
    []
  );

  const {
    conversations,
    selectedId,
    isLoading: isListLoading,
    loadingMode,
    error: conversationError,
    pendingFirstMessage,
    selectActivityConversation,
    startActivityConversation,
    clearPendingFirstMessage
  } = useActivityConversations(client);

  const [streaming, setStreaming] = useState(() => import.meta.env['VITE_USE_STREAMING'] !== 'false');

  const store = useConversationStates(client, { streaming });

  // Clean up all in-flight streams when the store changes and on unmount.
  useEffect(() => {
    return () => {
      store.abortAll();
    };
  }, [store]);

  const {
    messages,
    streamingContent,
    isLoading: isChatLoading,
    error: chatError,
    outcome,
    activeSpecialist,
    sendMessage
  } = useChat(store, selectedId, {
    streaming,
    pendingFirstMessage,
    onPendingFirstMessageConsumed: clearPendingFirstMessage
  });

  return (
    <div className='flex h-screen flex-col bg-zinc-950' data-testid='app'>
      <header className='flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-5 py-3'>
        <h1 className='text-lg font-semibold tracking-wide text-zinc-100'>Account Team Workspace</h1>
        <StreamToggle streaming={streaming} onChange={setStreaming} />
      </header>
      {conversationError && (
        <div
          className='border-b border-red-800 bg-red-950 px-5 py-2 text-sm text-red-300'
          data-testid='conversation-error'
          role='alert'
        >
          {conversationError}
        </div>
      )}
      <div className='flex flex-1 overflow-hidden'>
        <div className='flex w-72 flex-col border-r border-zinc-800 bg-zinc-900'>
          <ActivityPicker
            onStart={(mode) => void startActivityConversation(mode)}
            disabled={isListLoading}
            loadingMode={loadingMode}
          />
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={selectActivityConversation}
            isLoading={isListLoading}
          />
        </div>
        <main className='flex flex-1 flex-col overflow-hidden'>
          {selectedId ? (
            <>
              <ChatArea
                messages={messages}
                streamingContent={streamingContent}
                isLoading={isChatLoading}
                error={chatError}
                outcome={outcome}
                activeSpecialist={activeSpecialist}
              />
              <MessageInput
                onSend={(msg) => void sendMessage(msg)}
                disabled={isChatLoading || outcome != null}
                resolved={outcome != null}
              />
            </>
          ) : (
            <div
              className='flex flex-1 items-center justify-center p-10 text-center text-zinc-500 italic'
              data-testid='no-selection'
            >
              Pick an activity from the sidebar to start a sales/account-team scenario.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
