import { http } from '@/shared/lib/http';
import { env } from '@/shared/lib/env';
import type {
    SupportAttachmentView,
    SupportAvailability,
    SupportConversationView,
    SupportMessageView,
} from '@/features/support/types';

/**
 * The customer's side of a Support Chat.
 *
 * Every call but `availability` needs an account: ADR-0032 settled that a chat is answered
 * inside the app, so one started by someone signed out is one an Agent answers into a void.
 * The API refuses those with 401 and the widget does not offer itself.
 */

interface ApiMessage {
    id:        string;
    sender:    string;
    body:      string;
    notice:    string | null;
    createdAt: string;
    translatedBody:    string | null;
    translatedLang:    string | null;
    translationStatus: 'pending' | 'translated' | 'untranslated' | null;
    attachments: SupportAttachmentView[];
}

/**
 * `sender` becomes `senderType`, matching the field the shared translation rule reads.
 *
 * Renamed here rather than in the rule, so the widget and the Agent's inbox can keep asking
 * the same question of the same field — which is the whole point of that rule living in one
 * place (see `lib/translationView`).
 */
function toView(m: ApiMessage): SupportMessageView {
    return {
        id:         m.id,
        senderType: m.sender,
        body:       m.body,
        noticeCode: m.notice,
        translatedBody:    m.translatedBody,
        translatedLang:    m.translatedLang,
        translationStatus: m.translationStatus,
        attachments: m.attachments ?? [],
        createdAt:  m.createdAt,
    };
}

/** Whether a person can be reached right now. Public — it says nothing about any chat. */
export async function fetchAvailability(): Promise<SupportAvailability> {
    const res = await http.get<{ data: SupportAvailability }>('/support/availability');
    return res.data;
}

/**
 * Open a conversation, or resume the one already open. Idempotent by design, so the widget
 * can call it every time the panel opens without minting a chat per click.
 */
export async function openConversation(locale: string): Promise<SupportConversationView> {
    const res = await http.post<{ data: SupportConversationView }>('/support/conversation', { locale });
    return res.data;
}

/**
 * The caller's conversation and its transcript, or null when they have never opened one.
 *
 * Null is not an error: a customer who has never written in has no chat, and the widget
 * offers to start one rather than showing an empty transcript.
 */
export async function fetchConversation(): Promise<{
    conversation: SupportConversationView;
    messages: SupportMessageView[];
} | null> {
    const res = await http.get<{
        data: { conversation: SupportConversationView; messages: ApiMessage[] } | null;
    }>('/support/conversation');
    if (!res.data) return null;
    return { conversation: res.data.conversation, messages: res.data.messages.map(toView) };
}

export async function sendMessage(conversationId: string, body: string, attachmentIds: string[] = []): Promise<SupportMessageView> {
    const res = await http.post<{ data: ApiMessage }>(
        `/support/conversation/${conversationId}/messages`,
        attachmentIds.length > 0 ? { body, attachmentIds } : { body });
    return toView(res.data);
}

/**
 * Send one file, before the message that will carry it.
 *
 * Multipart, so no `Content-Type` header is set by hand — the browser has to add the boundary.
 * The response names the attachment by id; the send that follows lists those ids.
 */
export async function uploadAttachment(conversationId: string, file: File): Promise<SupportAttachmentView> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/support/conversation/${conversationId}/attachments`, {
        method: 'POST', body: form, credentials: 'include',
    });
    if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.message ?? 'That file could not be sent.');
    }
    return (await res.json()).data as SupportAttachmentView;
}

/**
 * Where the bytes are fetched from.
 *
 * A route in the API, not a bucket URL: it re-checks on every request that this caller may read
 * this file, then redirects to a signed URL good for five minutes. Nothing durable to leak.
 */
export function attachmentHref(id: string): string {
    return `${env.NEXT_PUBLIC_API_URL}/support/attachments/${id}`;
}

/**
 * What the widget offered, and what the customer did with it (ADR-0043).
 *
 * Never awaited and never surfaced: a customer is asking a question, not filing a report, and a
 * failed counter is our problem. `keepalive` so the last one survives the panel closing.
 */
export function reportSuggestion(articleId: string, outcome: string, locale: string): void {
    void fetch(`${env.NEXT_PUBLIC_API_URL}/support/suggestions`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        keepalive:   true,
        body:        JSON.stringify({ articleId, outcome, locale }),
    }).catch(() => {});
}

/**
 * The live stream, as an EventSource.
 *
 * Returned rather than subscribed to here: what to do with an event is the widget's business,
 * and closing it is the caller's responsibility. `withCredentials` because the session travels
 * in a cookie, exactly as it does for every other call.
 *
 * An event names a conversation and a message; it does not carry the message. The widget
 * refetches, which is also how a translation landing later reaches the screen — the row
 * changes without anything new being written to the conversation.
 */
export function openStream(): EventSource {
    return new EventSource(`${env.NEXT_PUBLIC_API_URL}/support/stream`, { withCredentials: true });
}
