/**
 * The Support Desk, rendered.
 *
 * Two of these are ADRs rather than preferences, and both are invisible in a screenshot: a chat
 * is **given** by an admin and never taken (ADR-0041), and Waiting is ordered by the server by
 * proximity to travel (ADR-0039) — a desk that re-sorts it locally is a desk whose queue no
 * longer means what it says.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportDeskView } from '@/features/support/components/SupportDeskView';
import { useAuthStore } from '@/shared/auth/store';

const api = vi.hoisted(() => ({
    fetchInbox:                 vi.fn(),
    fetchConversationForAgent:  vi.fn(),
    replyAsAgent:               vi.fn(),
    assignConversation:         vi.fn(),
    returnToQueue:              vi.fn(),
    resolveConversation:        vi.fn(),
    fetchDeskStaff:             vi.fn(),
    openDeskStream:             vi.fn(),
}));
vi.mock('@/features/support/api/adminSupport.api', () => api);

const row = (over = {}) => ({
    id: 'c1', reference: 'CG-1001', status: 'waiting_human', locale: 'ko',
    createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T09:00:00.000Z',
    urgency: 'travelling_now', assignedAdminId: null,
    customerEmail: 'traveller@example.com', messageCount: 2, ...over,
});

const transcript = (over = {}) => ({
    conversation: { ...row(), assignedAdminId: null },
    messages: [{
        id: 'm1', senderType: 'guest', body: '제 항공편이 취소되었습니다', noticeCode: null,
        translatedBody: 'My flight was cancelled.', translatedLang: 'en', translationStatus: 'translated' as const,
        createdAt: '2026-09-25T10:00:00.000Z',
    }],
    canWrite: true,
    ...over,
});

const signIn = (role: string) =>
    useAuthStore.setState({ user: { id: 'a1', email: 'agent@example.com', role } as never });

describe('SupportDeskView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.fetchInbox.mockResolvedValue([row()]);
        api.fetchConversationForAgent.mockResolvedValue(transcript());
        api.fetchDeskStaff.mockResolvedValue([{ id: 'a2', fullName: 'Sam Agent', email: 's@x.com', role: 'support_agent' }]);
        api.openDeskStream.mockReturnValue({ addEventListener: vi.fn(), close: vi.fn() });
        signIn('admin');
    });

    it('opens on Waiting, which is the queue that needs triaging', async () => {
        render(<SupportDeskView />);
        await waitFor(() => expect(api.fetchInbox).toHaveBeenCalledWith('unassigned'));
        expect(await screen.findByText('traveller@example.com')).toBeInTheDocument();
    });

    it('shows the queue in the order the server sent it, never re-sorted', async () => {
        // Proximity to travel is the server's judgement (ADR-0039). Sorting by anything visible
        // here — a date, an email — would quietly replace it.
        api.fetchInbox.mockResolvedValue([
            row({ id: 'c1', customerEmail: 'zoe@example.com',  urgency: 'travelling_now' }),
            row({ id: 'c2', customerEmail: 'adam@example.com', urgency: 'upcoming' }),
        ]);
        render(<SupportDeskView />);

        const emails = await screen.findAllByText(/@example\.com/);
        expect(emails.map(e => e.textContent)).toEqual(['zoe@example.com', 'adam@example.com']);
    });

    it('reads a Korean message in English, with the customer’s own words still there', async () => {
        render(<SupportDeskView />);
        await userEvent.click(await screen.findByText('traveller@example.com'));

        expect(await screen.findByText('My flight was cancelled.')).toBeInTheDocument();
        // ADR-0033: the author's words stay authoritative, so an Agent can always see them.
        expect(screen.getByText('제 항공편이 취소되었습니다')).toBeInTheDocument();
    });

    it('lets an admin hand a chat to someone', async () => {
        render(<SupportDeskView />);
        await userEvent.click(await screen.findByText('traveller@example.com'));

        await userEvent.selectOptions(await screen.findByLabelText('Assign to'), 'a2');
        await waitFor(() => expect(api.assignConversation).toHaveBeenCalledWith('c1', 'a2'));
    });

    it('offers an Agent no way to assign one to themselves (ADR-0041)', async () => {
        signIn('support_agent');
        render(<SupportDeskView />);
        await userEvent.click(await screen.findByText('traveller@example.com'));

        // Anchored, or it also matches the "Resolved" filter tab.
        await screen.findByRole('button', { name: /^resolve$/i });
        expect(screen.queryByLabelText('Assign to')).toBeNull();
    });

    it('lets the holder reply', async () => {
        render(<SupportDeskView />);
        await userEvent.click(await screen.findByText('traveller@example.com'));

        await userEvent.type(await screen.findByLabelText('Reply'), 'Looking into it now.');
        await userEvent.click(screen.getByRole('button', { name: /send reply/i }));
        await waitFor(() => expect(api.replyAsAgent).toHaveBeenCalledWith('c1', 'Looking into it now.', []));
    });

    it('and says plainly why someone else’s chat cannot be answered', async () => {
        api.fetchConversationForAgent.mockResolvedValue(transcript({ canWrite: false }));
        render(<SupportDeskView />);
        await userEvent.click(await screen.findByText('traveller@example.com'));

        expect(await screen.findByText(/only they can reply/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Reply')).toBeNull();
    });

    it('returns a chat to the queue rather than to a named colleague', async () => {
        render(<SupportDeskView />);
        await userEvent.click(await screen.findByText('traveller@example.com'));

        await userEvent.click(await screen.findByRole('button', { name: /return/i }));
        await waitFor(() => expect(api.returnToQueue).toHaveBeenCalledWith('c1'));
    });
});
