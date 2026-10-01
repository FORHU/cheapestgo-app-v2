import type { SupportConversationView, SupportMessageView } from '@/features/support/types';

/**
 * The widget's state, as a reducer.
 *
 * Kept apart from fetch and EventSource because the interesting behaviour is neither of them:
 * it is that a message arrives more than once. The customer's own message comes back as the
 * response to the POST that sent it *and* over the stream, which carries every row written to
 * the conversation and cannot know which of them this tab caused. A reply arrives again each
 * time its translation moves on (ADR-0033).
 *
 * Ported from v1's widget minus the assistant: ADR-0031 settled that support is answered only
 * by people, so the typing indicator, the "assistant is offline" banner and the escalation
 * handover have no v2 equivalent and are not carried across. Everything that remains is about
 * the same message arriving twice, which did not go away.
 */

/** A message shown before the server has confirmed it. */
interface PendingMessage {
    clientId:  string;
    body:      string;
    createdAt: string;
}

export interface SupportState {
    conversation: SupportConversationView | null;
    confirmed:    SupportMessageView[];
    pending:      PendingMessage[];
    /** Newest confirmed message id — where a reconnecting stream resumes from. */
    cursor:       string | null;
    unread:       number;
    panelOpen:    boolean;
}

export const initialSupportState: SupportState = {
    conversation: null,
    confirmed:    [],
    pending:      [],
    cursor:       null,
    unread:       0,
    panelOpen:    false,
};

export type SupportAction =
    | { type: 'opened';       conversation: SupportConversationView; messages: SupportMessageView[] }
    | { type: 'sent';         clientId: string; body: string; at: string }
    | { type: 'confirmed';    clientId: string; message: SupportMessageView }
    | { type: 'send_failed';  clientId: string }
    | { type: 'received';     message: SupportMessageView }
    | { type: 'closed' }
    | { type: 'opened_panel' };

/** The staff working language. A translation into anything else is for the customer. */
const AGENT_LANG = 'en';

/**
 * A reply whose translation for this customer has not settled yet — held back from the
 * transcript until it has.
 *
 * A customer who writes Korean reads an Agent's reply in Korean, not in English first and
 * Korean a few seconds later. So the reply appears once its translation is done — or, when
 * translating fails, in the Agent's own words, marked. It is never held indefinitely: the
 * server settles every translation, including ones a restart interrupted.
 *
 * Only a translation *for this reader* holds anything. A customer's own message, pending its
 * English rendering for the inbox, is shown at once — that English is not theirs to wait for.
 */
export function isHeldForTranslation(message: SupportMessageView): boolean {
    return message.translationStatus === 'pending'
        && Boolean(message.translatedLang)
        && message.translatedLang !== AGENT_LANG;
}

/** Whether a reply exists that the customer is waiting on the translation of. */
export function awaitingTranslation(state: SupportState): boolean {
    return state.confirmed.some(isHeldForTranslation);
}

/**
 * How far a message's translation has got. It only ever moves forward — nothing, then
 * translating, then translated or not — so a copy further along is the newer copy.
 */
function translationProgress(message: SupportMessageView): number {
    switch (message.translationStatus) {
        case 'translated':
        case 'untranslated': return 2;
        case 'pending':      return 1;
        default:             return 0;
    }
}

/**
 * Add a message, or update the copy already on screen.
 *
 * Keeping the first copy and dropping the rest is the tempting version, and it is wrong: the
 * server sends the row again each time its translation moves on, so a customer would read an
 * Agent's English reply with no translation and no "translating…" either, until they reloaded.
 *
 * The copies do not arrive in order — the POST response for the customer's own message can
 * land after the stream has already delivered it — so an older copy never replaces a newer one.
 */
function withMessage(
    confirmed: SupportMessageView[],
    message:   SupportMessageView,
): SupportMessageView[] {
    const index = confirmed.findIndex(existing => existing.id === message.id);
    if (index === -1) return [...confirmed, message];
    if (translationProgress(message) < translationProgress(confirmed[index])) return confirmed;

    const next = [...confirmed];
    next[index] = message;
    return next;
}

/**
 * Where a reconnecting stream resumes from: the newest message — unless a reply is still held
 * for its translation, in which case just before the oldest such reply.
 *
 * The stream's backfill sends only what comes after the cursor. A reply translated while the
 * connection was down is an *update* to a message already received, so a cursor past it would
 * never hear of the translation, and the reply would stay held for good.
 */
function resumeCursor(confirmed: SupportMessageView[]): string | null {
    const ordered = [...confirmed].sort(byCreatedAt);
    const firstHeld = ordered.findIndex(isHeldForTranslation);
    if (firstHeld === -1) return ordered.at(-1)?.id ?? null;
    return firstHeld === 0 ? null : ordered[firstHeld - 1].id;
}

function byCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
    return a.createdAt.localeCompare(b.createdAt);
}

export function supportReducer(state: SupportState, action: SupportAction): SupportState {
    switch (action.type) {
        case 'opened':
            return {
                ...state,
                conversation: action.conversation,
                confirmed:    action.messages,
                cursor:       resumeCursor(action.messages),
            };

        case 'sent':
            return {
                ...state,
                pending: [...state.pending, { clientId: action.clientId, body: action.body, createdAt: action.at }],
            };

        case 'confirmed': {
            const confirmed = withMessage(state.confirmed, action.message);
            return {
                ...state,
                confirmed,
                pending: state.pending.filter(p => p.clientId !== action.clientId),
                cursor:  resumeCursor(confirmed),
            };
        }

        case 'send_failed':
            // Nothing is coming: the message never reached the server.
            return { ...state, pending: state.pending.filter(p => p.clientId !== action.clientId) };

        case 'received': {
            // An update to a message already on screen — its translation arriving — is not a
            // new message: it must not raise the unread badge again.
            const isNew     = !state.confirmed.some(existing => existing.id === action.message.id);
            const confirmed = withMessage(state.confirmed, action.message);

            // The stream beat the POST response to the customer's own message. Matching on the
            // text is imprecise, but the alternative is showing someone their own words twice
            // until the response lands.
            const pending = action.message.senderType === 'guest'
                ? state.pending.filter(p => p.body !== action.message.body)
                : state.pending;

            return {
                ...state,
                confirmed,
                pending,
                cursor: resumeCursor(confirmed),
                // Only what arrived while nobody was reading, and only from the other side —
                // the customer's own message coming back is not news to them.
                unread: isNew && !state.panelOpen && action.message.senderType !== 'guest'
                    ? state.unread + 1
                    : state.unread,
            };
        }

        case 'closed':
            return { ...state, panelOpen: false };

        case 'opened_panel':
            // Opening it is reading it.
            return { ...state, panelOpen: true, unread: 0 };

        default:
            return state;
    }
}

/**
 * What the transcript renders: confirmed rows and anything still in flight, in the order they
 * were created rather than the order they arrived. A reply still being translated for this
 * customer is left out until it settles — see `isHeldForTranslation`.
 */
export function visibleMessages(state: SupportState): SupportMessageView[] {
    const optimistic: SupportMessageView[] = state.pending.map(p => ({
        id:         `pending-${p.clientId}`,
        senderType: 'guest',
        body:       p.body,
        noticeCode: null,
        // Nothing has been rendered yet — the row does not exist server-side, and a customer
        // is never shown a machine rendering of their own words in any case.
        translatedBody:    null,
        translatedLang:    null,
        translationStatus: null,
        createdAt:  p.createdAt,
        pending:    true,
    }));

    const shown = state.confirmed.filter(message => !isHeldForTranslation(message));
    return [...shown, ...optimistic].sort(byCreatedAt);
}
