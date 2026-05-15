import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatArea } from '../../src/components/ChatArea.tsx';
import type { ActivityOutcome, ActivityMessage } from '../../src/types.ts';

const MESSAGES: ActivityMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Hello!',
    createdAt: '2026-01-01T12:00:00Z'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Welcome to the workspace!',
    createdAt: '2026-01-01T12:00:01Z'
  }
];

const DISCOVERY_OUTCOME: ActivityOutcome = {
  tool: 'resolve_discovery',
  result: { fit: 'qualified', signals_reviewed: 4, primary_need: 'Needs clearer forecasting' }
};

const PLANNING_OUTCOME: ActivityOutcome = {
  tool: 'resolve_planning',
  result: {
    approved: true,
    focus_area: 'Pipeline coverage',
    next_step: 'Coordinate the North America review'
  }
};

describe('ChatArea', () => {
  it('renders messages', () => {
    render(<ChatArea messages={MESSAGES} streamingContent='' isLoading={false} error={null} />);
    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the workspace!')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<ChatArea messages={[]} streamingContent='' isLoading={false} error={null} />);
    expect(screen.getByTestId('chat-area-empty')).toBeInTheDocument();
  });

  it('shows loading indicator', () => {
    render(<ChatArea messages={[]} streamingContent='' isLoading={true} error={null} />);
    expect(screen.getByTestId('chat-area-loading')).toBeInTheDocument();
    expect(screen.getByText('The coordinator is thinking...')).toBeInTheDocument();
  });

  it('shows streaming content', () => {
    render(
      <ChatArea messages={MESSAGES} streamingContent='Let me walk through that...' isLoading={true} error={null} />
    );
    expect(screen.getByTestId('streaming-message')).toBeInTheDocument();
    expect(screen.getByText('Let me walk through that...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<ChatArea messages={[]} streamingContent='' isLoading={false} error='Connection lost!' />);
    expect(screen.getByTestId('chat-area-error')).toBeInTheDocument();
    expect(screen.getByText('Connection lost!')).toBeInTheDocument();
  });

  it('does not show loading when streaming content exists', () => {
    render(<ChatArea messages={[]} streamingContent='Streaming...' isLoading={true} error={null} />);
    expect(screen.queryByTestId('chat-area-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('streaming-message')).toBeInTheDocument();
  });

  // ---- Outcome card tests ----

  it('renders outcome card when outcome is provided', () => {
    render(
      <ChatArea messages={MESSAGES} streamingContent='' isLoading={false} error={null} outcome={DISCOVERY_OUTCOME} />
    );
    expect(screen.getByTestId('outcome-card')).toBeInTheDocument();
    expect(screen.getByText('Discovery Summary')).toBeInTheDocument();
  });

  it('does not render outcome card when outcome is null', () => {
    render(<ChatArea messages={MESSAGES} streamingContent='' isLoading={false} error={null} outcome={null} />);
    expect(screen.queryByTestId('outcome-card')).not.toBeInTheDocument();
  });

  it('renders outcome card with planning result details', () => {
    render(
      <ChatArea messages={MESSAGES} streamingContent='' isLoading={false} error={null} outcome={PLANNING_OUTCOME} />
    );
    expect(screen.getByText('Account Plan Summary')).toBeInTheDocument();
    const details = screen.getByTestId('outcome-details');
    expect(details).toBeInTheDocument();
    expect(screen.getByText('Pipeline coverage')).toBeInTheDocument();
    expect(screen.getByText('Coordinate the North America review')).toBeInTheDocument();
  });

  // ---- Specialist activity indicator tests ----

  it('shows specialist-specific loading text when activeSpecialist is set', () => {
    render(
      <ChatArea
        messages={[]}
        streamingContent=''
        isLoading={true}
        error={null}
        activeSpecialist='discovery_specialist'
      />
    );
    expect(screen.getByTestId('chat-area-loading')).toBeInTheDocument();
    expect(screen.getByText('The discovery specialist is working...')).toBeInTheDocument();
  });

  it('shows coordinator thinking when activeSpecialist is null', () => {
    render(<ChatArea messages={[]} streamingContent='' isLoading={true} error={null} activeSpecialist={null} />);
    expect(screen.getByText('The coordinator is thinking...')).toBeInTheDocument();
  });

  it('shows planning specialist loading text', () => {
    render(
      <ChatArea
        messages={[]}
        streamingContent=''
        isLoading={true}
        error={null}
        activeSpecialist='planning_specialist'
      />
    );
    expect(screen.getByText('The account planning specialist is working...')).toBeInTheDocument();
  });

  it('shows staffing specialist loading text', () => {
    render(
      <ChatArea
        messages={[]}
        streamingContent=''
        isLoading={true}
        error={null}
        activeSpecialist='staffing_specialist'
      />
    );
    expect(screen.getByText('The staffing specialist is working...')).toBeInTheDocument();
  });
});
