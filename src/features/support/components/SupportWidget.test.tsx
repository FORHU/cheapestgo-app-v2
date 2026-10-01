/**
 * The widget, rendered.
 *
 * The reducer's tests cover what the transcript should contain; these cover that the thing on
 * screen is wired to it at all. A signed-out page renders nothing here by design (ADR-0032),
 * which looks identical to a widget that never mounted — so the mounting is asserted from the
 * other side, with someone signed in.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { SupportWidget } from '@/features/support/components/SupportWidget';
import en from '@/locales/en.json';
import { useAuthStore } from '@/shared/auth/store';

const conversation = {
    id: 'c1', reference: 'CG-4821', status: 'waiting_human', locale: 'ko',
    createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T09:00:00.000Z',
};

const api = vi.hoisted(() => ({
    uploadAttachment:  vi.fn(),
    attachmentHref:    vi.fn((id: string) => `/api/v2/support/attachments/${id}`),
    reportSuggestion:  vi.fn(),
    fetchAvailability: vi.fn(),
    fetchConversation: vi.fn(),
    openConversation:  vi.fn(),
    sendMessage:       vi.fn(),
    openStream:        vi.fn(),
}));

vi.mock('@/features/support/api/support.api', () => api);

const signedIn = (yes: boolean) =>
    useAuthStore.setState({ user: yes ? ({ id: 'u1', email: 'someone@example.com' } as never) : null });

function renderWidget() {
    return render(
        <NextIntlClientProvider locale="en" messages={en as never}>
            <SupportWidget />
        </NextIntlClientProvider>,
    );
}

describe('SupportWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.fetchAvailability.mockResolvedValue({
            humanAvailable: true, hours: { timezone: 'Asia/Manila', days: {} }, nextOpening: null,
        });
        api.openConversation.mockResolvedValue(conversation);
        api.fetchConversation.mockResolvedValue({ conversation, messages: [] });
        api.openStream.mockReturnValue({ addEventListener: vi.fn(), close: vi.fn() });
        signedIn(true);
    });

    it('offers nothing to a visitor with no account (ADR-0032)', () => {
        signedIn(false);
        renderWidget();
        expect(screen.queryByRole('button', { name: /open support chat/i })).toBeNull();
    });

    it('offers itself to someone signed in', () => {
        renderWidget();
        expect(screen.getByRole('button', { name: /open support chat/i })).toBeInTheDocument();
    });

    it('creates no chat for someone who only reads, not even on opening the panel', async () => {
        // ADR-0044: a customer who taps a question, reads the answer and leaves should not be
        // left with a chat, a reference and a doorbell ring behind them. Writing is what starts
        // a chat — looking is not.
        api.fetchConversation.mockResolvedValue(null);
        renderWidget();

        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await waitFor(() => expect(api.fetchConversation).toHaveBeenCalled());
        expect(api.openConversation).not.toHaveBeenCalled();
    });

    it('and starts one on the first message', async () => {
        api.fetchConversation.mockResolvedValue(null);
        api.sendMessage.mockResolvedValue({
            id: 'm1', senderType: 'guest', body: 'hello', noticeCode: null,
            translatedBody: null, translatedLang: null, translationStatus: null,
            createdAt: '2026-09-25T10:00:00.000Z',
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.type(await screen.findByLabelText(/type your message/i), 'hello');
        await userEvent.click(screen.getByRole('button', { name: /^send$/i }));

        await waitFor(() => expect(api.openConversation).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith('c1', 'hello', []));
    });

    it('shows the Chat Reference, which is what a customer quotes', async () => {
        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        expect(await screen.findByText(/CG-4821/)).toBeInTheDocument();
    });

    it('shows a message the moment it is sent, before the server answers', async () => {
        let settle: (v: unknown) => void = () => {};
        api.sendMessage.mockReturnValue(new Promise(res => { settle = res; }));

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await screen.findByText(/CG-4821/);

        await userEvent.type(screen.getByLabelText(/type your message/i), 'my flight was cancelled');
        await userEvent.click(screen.getByRole('button', { name: /^send$/i }));

        expect(await screen.findByText('my flight was cancelled')).toBeInTheDocument();
        settle({
            id: 'm1', senderType: 'guest', body: 'my flight was cancelled', noticeCode: null,
            translatedBody: null, translatedLang: null, translationStatus: null,
            createdAt: '2026-09-25T10:00:00.000Z',
        });
    });

    it('reads an Agent reply in the language the customer reads, with the original one click away', async () => {
        api.fetchConversation.mockResolvedValue({
            conversation,
            messages: [{
                id: 'm2', senderType: 'agent', body: 'Looking into it now.', noticeCode: null,
                translatedBody: '확인 중입니다.', translatedLang: 'ko', translationStatus: 'translated',
                createdAt: '2026-09-25T10:01:00.000Z',
            }],
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));

        // The rendering, not the English it was made from.
        expect(await screen.findByText('확인 중입니다.')).toBeInTheDocument();
        expect(screen.queryByText('Looking into it now.')).toBeNull();

        // ADR-0033: a stored translation can be wrong, so the author's words stay reachable.
        await userEvent.click(screen.getByRole('button', { name: /show original/i }));
        expect(await screen.findByText('Looking into it now.')).toBeInTheDocument();
    });

    it('says when the desk reopens rather than leaving a message unanswered in silence', async () => {
        api.fetchAvailability.mockResolvedValue({
            humanAvailable: false,
            hours: { timezone: 'Asia/Manila', days: {} },
            nextOpening: { day: 'mon', open: '09:00', timezone: 'Asia/Manila', today: false },
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        expect(await screen.findByText(/we reply from/i)).toBeInTheDocument();
    });
});
describe('the questions it answers itself (ADR-0044)', () => {
    beforeEach(() => {
        // Nothing written yet, which is when the questions are offered.
        api.fetchConversation.mockResolvedValue(null);
    });

    it('opens with the common questions, so nothing has to be typed first', async () => {
        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));

        expect(await screen.findByRole('button', { name: /where's my confirmation\?/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /when do i get my refund\?/i })).toBeInTheDocument();
    });

    it('answers one in the chat window, from a person\u2019s writing, labelled as automated', async () => {
        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.click(await screen.findByRole('button', { name: /where's my confirmation\?/i }));

        // The stored article, and the customer told plainly that nobody typed it.
        expect(await screen.findByText(/check trips while signed in/i)).toBeInTheDocument();
        expect(screen.getByText(/automated/i)).toBeInTheDocument();
    });

    it('and shows it without writing anything to the transcript', async () => {
        // A transcript is what the customer and the Agent said to each other; every row in it
        // must have an author. What was shown is recorded as a suggestion event instead.
        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.click(await screen.findByRole('button', { name: /where's my confirmation\?/i }));

        await screen.findByText(/check trips while signed in/i);
        expect(api.sendMessage).not.toHaveBeenCalled();
        expect(api.openConversation).not.toHaveBeenCalled();
        expect(api.reportSuggestion).toHaveBeenCalledWith('confirmation', 'opened', 'en');
    });

    it('ends it with no chat in the queue when that answered it', async () => {
        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.click(await screen.findByRole('button', { name: /where's my confirmation\?/i }));
        await userEvent.click(await screen.findByRole('button', { name: /that answered it/i }));

        expect(api.reportSuggestion).toHaveBeenCalledWith('confirmation', 'solved', 'en');
        expect(api.openConversation).not.toHaveBeenCalled();
        expect(screen.queryByText(/check trips while signed in/i)).toBeNull();
    });

    it('sends the question as the customer\u2019s own words when they ask for a person', async () => {
        api.sendMessage.mockResolvedValue({
            id: 'm1', senderType: 'guest', body: "Where's my confirmation?", noticeCode: null,
            translatedBody: null, translatedLang: null, translationStatus: null,
            createdAt: '2026-09-25T10:00:00.000Z',
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.click(await screen.findByRole('button', { name: /where's my confirmation\?/i }));
        await userEvent.click(await screen.findByRole('button', { name: /talk to a person/i }));

        await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith('c1', "Where's my confirmation?", []));
        expect(api.reportSuggestion).toHaveBeenCalledWith('confirmation', 'sent_anyway', 'en');
    });

    it('never answers a payment problem itself \u2014 that goes straight to a person', async () => {
        // Money questions are the ones where a wrong answer in the company's voice costs most:
        // a double charge, suspected fraud, a chargeback. ADR-0044 keeps them out of this.
        api.sendMessage.mockResolvedValue({
            id: 'm1', senderType: 'guest', body: 'A payment problem', noticeCode: null,
            translatedBody: null, translatedLang: null, translationStatus: null,
            createdAt: '2026-09-25T10:00:00.000Z',
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.click(await screen.findByRole('button', { name: /a payment problem/i }));

        await waitFor(() => expect(api.sendMessage).toHaveBeenCalled());
        expect(screen.queryByRole('button', { name: /that answered it/i })).toBeNull();
    });
});
describe('attachments (ADR-0040)', () => {
    const file = () => new File(['%PDF-1.4 pretend'], 'boarding-pass.pdf', { type: 'application/pdf' });

    it('offers no paperclip when there is nowhere to put a file', async () => {
        // A missing bucket is deployment configuration, not something a customer can fix, so the
        // control is absent rather than present and failing.
        api.fetchAvailability.mockResolvedValue({
            humanAvailable: true, attachments: false, hours: { timezone: 'Asia/Manila', days: {} }, nextOpening: null,
        });
        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));

        await screen.findByLabelText(/type your message/i);
        expect(screen.queryByLabelText(/attach a file/i)).toBeNull();
    });

    it('sends a chosen file and shows it waiting to go', async () => {
        api.fetchAvailability.mockResolvedValue({
            humanAvailable: true, attachments: true, hours: { timezone: 'Asia/Manila', days: {} }, nextOpening: null,
        });
        api.uploadAttachment.mockResolvedValue({
            id: 'a1', fileName: 'boarding-pass.pdf', contentType: 'application/pdf',
            sizeBytes: 16, uploadedByType: 'guest', bytesDeleted: false,
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.upload(await screen.findByLabelText(/attach a file/i), file());

        await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalled());
        expect(await screen.findByText('boarding-pass.pdf')).toBeInTheDocument();
    });

    it('names it on the message that carries it, then clears it', async () => {
        api.fetchAvailability.mockResolvedValue({
            humanAvailable: true, attachments: true, hours: { timezone: 'Asia/Manila', days: {} }, nextOpening: null,
        });
        api.uploadAttachment.mockResolvedValue({
            id: 'a1', fileName: 'boarding-pass.pdf', contentType: 'application/pdf',
            sizeBytes: 16, uploadedByType: 'guest', bytesDeleted: false,
        });
        api.sendMessage.mockResolvedValue({
            id: 'm1', senderType: 'guest', body: 'here it is', noticeCode: null,
            translatedBody: null, translatedLang: null, translationStatus: null,
            attachments: [], createdAt: '2026-09-25T10:00:00.000Z',
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));
        await userEvent.upload(await screen.findByLabelText(/attach a file/i), file());
        await screen.findByText('boarding-pass.pdf');

        await userEvent.type(screen.getByLabelText(/type your message/i), 'here it is');
        await userEvent.click(screen.getByRole('button', { name: /^send$/i }));

        await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith('c1', 'here it is', ['a1']));
    });

    it('links a received file through the API, never to a bucket', async () => {
        api.fetchConversation.mockResolvedValue({
            conversation,
            messages: [{
                id: 'm2', senderType: 'agent', body: 'Here is your voucher.', noticeCode: null,
                translatedBody: null, translatedLang: null, translationStatus: null,
                createdAt: '2026-09-25T10:01:00.000Z',
                attachments: [{
                    id: 'a9', fileName: 'voucher.pdf', contentType: 'application/pdf',
                    sizeBytes: 900, uploadedByType: 'agent', bytesDeleted: false,
                }],
            }],
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));

        const link = await screen.findByRole('link', { name: /voucher\.pdf/i });
        expect(link.getAttribute('href')).toContain('/support/attachments/a9');
    });

    it('and says so plainly when the bytes are past their retention window', async () => {
        api.fetchConversation.mockResolvedValue({
            conversation,
            messages: [{
                id: 'm3', senderType: 'guest', body: 'my passport', noticeCode: null,
                translatedBody: null, translatedLang: null, translationStatus: null,
                createdAt: '2026-09-25T10:02:00.000Z',
                attachments: [{
                    id: 'a8', fileName: 'passport.jpg', contentType: 'image/jpeg',
                    sizeBytes: 100, uploadedByType: 'guest', bytesDeleted: true,
                }],
            }],
        });

        renderWidget();
        await userEvent.click(screen.getByRole('button', { name: /open support chat/i }));

        // Still in the transcript — a conversation must not read as though nothing was sent.
        expect(await screen.findByText('passport.jpg')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /passport\.jpg/i })).toBeNull();
    });
});


