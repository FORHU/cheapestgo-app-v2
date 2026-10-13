import { http } from '@/shared/lib/http';
import { env } from '@/shared/lib/env';
import type { SupportAttachmentView, SupportConversationView, SupportMessageView } from '@/features/support/types';

/**
 * The Agent's side of the desk.
 *
 * Not restricted to admins: a Support Agent answers chats and can do nothing else here, so the
 * API checks per action rather than at the door — reading is open to every Agent, writing is
 * limited to whoever holds the chat, and assigning is an admin's alone (ADR-0041).
 */

export type InboxFilter = 'unassigned' | 'mine' | 'assigned' | 'resolved';

export interface InboxRow extends SupportConversationView {
    /** Ordered by the server, by proximity to travel (ADR-0039) — never re-sorted here. */
    urgency:         string;
    assignedAdminId: string | null;
    customerEmail:   string | null;
    messageCount:    number;
}

interface ApiMessage {
    id: string; sender: string; body: string; notice: string | null; createdAt: string;
    translatedBody: string | null;
    translatedLang: string | null;
    translationStatus: 'pending' | 'translated' | 'untranslated' | null;
    attachments: SupportAttachmentView[];
}

const toView = (m: ApiMessage): SupportMessageView => ({
    id: m.id, senderType: m.sender, body: m.body, noticeCode: m.notice,
    translatedBody: m.translatedBody, translatedLang: m.translatedLang,
    translationStatus: m.translationStatus, createdAt: m.createdAt,
    attachments: m.attachments ?? [],
});

export async function fetchInbox(filter: InboxFilter): Promise<InboxRow[]> {
    const res = await http.get<{ data: InboxRow[] }>(`/admin/support/conversations?filter=${filter}`);
    return res.data;
}

export interface AgentConversation {
    conversation: SupportConversationView & { assignedAdminId: string | null };
    messages:     SupportMessageView[];
    /** False when the chat belongs to someone else: the Agent may read it, not answer it. */
    canWrite:     boolean;
}

export async function fetchConversationForAgent(id: string): Promise<AgentConversation> {
    const res = await http.get<{ data: { conversation: AgentConversation['conversation']; messages: ApiMessage[]; canWrite: boolean } }>(
        `/admin/support/conversations/${id}`);
    return { ...res.data, messages: res.data.messages.map(toView) };
}

export async function replyAsAgent(id: string, body: string, attachmentIds: string[] = []): Promise<SupportMessageView> {
    const res = await http.post<{ data: ApiMessage }>(`/admin/support/conversations/${id}/messages`,
        attachmentIds.length > 0 ? { body, attachmentIds } : { body });
    return toView(res.data);
}

/** Admins only (ADR-0041): a chat is given to someone, never taken. */
export async function assignConversation(id: string, toAdminId: string): Promise<void> {
    await http.post(`/admin/support/conversations/${id}/assign`, { toAdminId });
}

/** Back to the queue, never to a named colleague. */
export async function returnToQueue(id: string): Promise<void> {
    await http.post(`/admin/support/conversations/${id}/return`);
}

export async function resolveConversation(id: string): Promise<void> {
    await http.post(`/admin/support/conversations/${id}/resolve`);
}

export interface DeskStaff {
    id:       string;
    fullName: string;
    email:    string;
    role:     string;
}

/**
 * Who a chat can be handed to.
 *
 * Read from the user list and filtered here, because "can answer support" is a role rather than
 * a roster: the API refuses an assignment to anyone else anyway, so this only decides what the
 * dropdown offers.
 */
export async function fetchDeskStaff(): Promise<DeskStaff[]> {
    const res = await http.get<{ users: DeskStaff[] }>('/admin/users');
    return res.users.filter(u => u.role === 'admin' || u.role === 'support_agent');
}

/** An Agent's own file — a receipt, a voucher, a form for the customer to sign. */
export async function uploadAgentAttachment(conversationId: string, file: File): Promise<SupportAttachmentView> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/support/conversations/${conversationId}/attachments`, {
        method: 'POST', body: form, credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? 'That file could not be sent.');
    return (await res.json()).data as SupportAttachmentView;
}

/**
 * Where an Agent fetches a customer's file.
 *
 * The staff route, not the customer one — the same service behind both, re-checking on every
 * request that this caller may read it (ADR-0040).
 */
export function agentAttachmentHref(id: string): string {
    return `${env.NEXT_PUBLIC_API_URL}/admin/support/attachments/${id}`;
}

/**
 * The Agent's stream: every conversation, not one.
 *
 * An Agent watches a queue rather than a chat, and a message in a chat they are not looking at
 * is exactly the thing they need to be told about. Each event names an id and the inbox
 * refetches.
 */
export function openDeskStream(): EventSource {
    return new EventSource(`${env.NEXT_PUBLIC_API_URL}/admin/support/stream`, { withCredentials: true });
}
