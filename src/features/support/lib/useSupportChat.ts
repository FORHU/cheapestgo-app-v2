'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/shared/auth/store';
import {
    fetchAvailability, fetchConversation, openConversation, openStream, sendMessage, uploadAttachment,
} from '@/features/support/api/support.api';
import {
    initialSupportState, supportReducer, visibleMessages, awaitingTranslation,
} from '@/features/support/lib/supportReducer';
import type { SupportAttachmentView, SupportAvailability } from '@/features/support/types';

/**
 * The customer's Support Chat: one conversation, held open.
 *
 * The reducer owns what is on screen (`lib/supportReducer`); this owns talking to the server.
 * Three things it has to get right, all of them about the same message arriving twice:
 *
 *  - a stream event names a message, it does not carry one, so the transcript is refetched and
 *    every row replayed through the reducer, which keeps the newer copy
 *  - the customer's own message is shown before the server answers, and removed again by
 *    whichever of the two confirmations arrives first
 *  - the stream is opened only once a conversation exists; before that the endpoint answers
 *    204 and an EventSource would simply fail and retry forever
 */
export function useSupportChat() {
    const locale = useLocale();
    const user   = useAuthStore(s => s.user);

    const [state, dispatch] = useReducer(supportReducer, initialSupportState);
    const [availability, setAvailability] = useState<SupportAvailability | null>(null);
    const [sending, setSending]           = useState(false);
    const [failed, setFailed]             = useState(false);
    // Uploaded and waiting for the message that will carry them. Held here rather than in the
    // reducer because nothing is on the transcript yet — there is no message to attach them to.
    const [staged, setStaged]             = useState<SupportAttachmentView[]>([]);
    const [attaching, setAttaching]       = useState(false);

    // Whether a conversation has been asked for yet. The panel opening is what asks: a chat
    // minted on page load would put an empty conversation in the Agent's queue for every
    // visitor who never writes.
    const started = useRef(false);

    useEffect(() => {
        fetchAvailability().then(setAvailability).catch(() => setAvailability(null));
    }, []);

    /** Pull the transcript and replay it; the reducer decides what is new. */
    const refresh = useCallback(async () => {
        const found = await fetchConversation().catch(() => null);
        if (!found) return;
        dispatch({ type: 'opened', conversation: found.conversation, messages: found.messages });
    }, []);

    const open = useCallback(async () => {
        dispatch({ type: 'opened_panel' });
        if (started.current) return;
        started.current = true;

        // Read only. A chat is *created* by writing to it (see `send`), not by looking: ADR-0044
        // exists to let someone read a Help Centre answer and leave without a chat, a reference
        // and a doorbell ring behind them.
        const found = await fetchConversation().catch(() => null);
        if (found) dispatch({ type: 'opened', conversation: found.conversation, messages: found.messages });
    }, []);

    const close = useCallback(() => dispatch({ type: 'closed' }), []);

    // The live stream, once there is something to follow.
    const conversationId = state.conversation?.id ?? null;
    useEffect(() => {
        if (!conversationId) return;
        const source = openStream();
        source.addEventListener('support', () => { void refresh(); });
        return () => source.close();
    }, [conversationId, refresh]);

    /**
     * A chat to write into, created on demand.
     *
     * Both attaching and sending are writing, and either can be the first thing a customer does
     * — so both come through here rather than one of them assuming the other happened first.
     */
    const conversationForWriting = useCallback(async () => {
        if (state.conversation) return state.conversation;
        const conversation = await openConversation(locale);
        dispatch({ type: 'opened', conversation, messages: [] });
        return conversation;
    }, [state.conversation, locale]);

    const attach = useCallback(async (file: File) => {
        setAttaching(true);
        setFailed(false);
        try {
            const conversation = await conversationForWriting();
            const stored = await uploadAttachment(conversation.id, file);
            setStaged(prev => [...prev, stored]);
        } catch {
            setFailed(true);
        } finally {
            setAttaching(false);
        }
    }, [conversationForWriting]);

    const unstage = useCallback((id: string) => setStaged(prev => prev.filter(a => a.id !== id)), []);

    const send = useCallback(async (body: string) => {
        const text = body.trim();
        if (!text) return;
        const files = staged;

        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        dispatch({ type: 'sent', clientId, body: text, at: new Date().toISOString() });
        setSending(true);
        setFailed(false);

        try {
            const conversation = await conversationForWriting();
            const message = await sendMessage(conversation.id, text, files.map(f => f.id));
            dispatch({ type: 'confirmed', clientId, message });
            // Only once they are bound to a message; a failed send leaves them staged to retry.
            setStaged([]);
        } catch {
            dispatch({ type: 'send_failed', clientId });
            setFailed(true);
        } finally {
            setSending(false);
        }
    }, [conversationForWriting, staged]);

    return {
        // ADR-0032: a chat is answered inside the app, so it is offered only to an account.
        available:    Boolean(user),
        conversation: state.conversation,
        messages:     visibleMessages(state),
        translating:  awaitingTranslation(state),
        unread:       state.unread,
        panelOpen:    state.panelOpen,
        availability,
        sending,
        failed,
        staged,
        attaching,
        // Hidden rather than offered-and-refused when no bucket is configured: that is a
        // deployment fact, not something a customer can do anything about.
        canAttach: availability?.attachments === true,
        attach,
        unstage,
        open,
        close,
        send,
    };
}
