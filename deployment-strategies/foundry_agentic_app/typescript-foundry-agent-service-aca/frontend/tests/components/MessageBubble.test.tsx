import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../../src/components/MessageBubble.tsx';
import type { ActivityMessage } from '../../src/types.ts';

const USER_MESSAGE: ActivityMessage = {
  id: 'msg-1',
  role: 'user',
  content: 'Hello there!',
  createdAt: '2026-01-01T12:00:00Z'
};

const ASSISTANT_MESSAGE: ActivityMessage = {
  id: 'msg-2',
  role: 'assistant',
  content: 'Welcome to the workspace!',
  createdAt: '2026-01-01T12:00:01Z'
};

describe('MessageBubble', () => {
  it('renders user message with correct role label', () => {
    render(<MessageBubble message={USER_MESSAGE} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello there!')).toBeInTheDocument();
  });

  it('renders assistant message with Assistant label', () => {
    render(<MessageBubble message={ASSISTANT_MESSAGE} />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the workspace!')).toBeInTheDocument();
  });

  it('applies user styling for user messages', () => {
    render(<MessageBubble message={USER_MESSAGE} />);
    const bubble = screen.getByTestId('message-msg-1');
    expect(bubble.getAttribute('data-role')).toBe('user');
  });

  it('applies assistant styling for assistant messages', () => {
    render(<MessageBubble message={ASSISTANT_MESSAGE} />);
    const bubble = screen.getByTestId('message-msg-2');
    expect(bubble.getAttribute('data-role')).toBe('assistant');
  });

  it('displays formatted time', () => {
    render(<MessageBubble message={USER_MESSAGE} />);
    // The bubble's last child div contains the time string
    const bubble = screen.getByTestId('message-msg-1');
    // Time element is the last child div — it should have some text content
    const timeEl = bubble.querySelector('div:last-child');
    expect(timeEl).toBeInTheDocument();
    expect(timeEl?.textContent).toBeTruthy();
  });
});
