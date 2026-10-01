/**
 * Which text a reader sees first for a Support Chat message, and what to say about it.
 *
 * One rule for both readers, kept here so the widget and the inbox cannot drift apart: **the
 * translation's language decides who it is for**, not who sent the message. A translation
 * into English is for the inbox; a translation into anything else is for the customer.
 *
 * Keying on the sender got one case wrong. An Agent who speaks Korean and answers in Korean
 * has their reply translated into English — for colleagues reading the inbox — and the
 * customer must see the Korean exactly as it was typed. Under "the other party's message is
 * shown translated" the customer was shown the English instead.
 *
 * The same rule still means a customer never sees the English rendering of their own
 * sentence, and an Agent's English reply is shown to the Agent as written.
 *
 * The author's words always stay reachable. ADR-0033 keeps them authoritative wherever the
 * two disagree, and a stored translation can be wrong and stays wrong — so the original is
 * one click away on every translated message, never replaced.
 */

export type TranslationState = 'pending' | 'translated' | 'untranslated' | null;

export interface TranslatableMessage {
    senderType: string;
    body: string;
    translatedBody?: string | null;
    /** The language the translation is in — or, while pending or failed, was to be made into. */
    translatedLang?: string | null;
    translationStatus?: TranslationState;
}

export interface ReaderView {
    /** What to show first. */
    primary: string;
    /** The author's own words, when `primary` is not them — for the "show original" toggle. */
    original: string | null;
    /** What to tell the reader, or null when there is nothing to say. */
    label: 'translated' | 'pending' | 'untranslated' | null;
}

/** The inbox reads English; ADR-0034. Mirrors AGENT_LANG on the server. */
const AGENT_LANG = 'en';

/**
 * @param readerIsAgent  true for the inbox, false for the customer's widget.
 */
export function readerView(message: TranslatableMessage, readerIsAgent: boolean): ReaderView {
    const asWritten: ReaderView = { primary: message.body, original: null, label: null };

    // A system notice, or nothing to translate.
    if (!message.translationStatus) return asWritten;
    if (message.senderType !== 'guest' && message.senderType !== 'agent') return asWritten;

    if (!isForThisReader(message, readerIsAgent)) return asWritten;

    if (message.translationStatus === 'translated' && message.translatedBody) {
        return { primary: message.translatedBody, original: message.body, label: 'translated' };
    }

    // Pending or untranslated: the author's words, marked. For an Agent this is the moment
    // that matters — a customer's message that could not be translated is shown in their
    // language and flagged, rather than as a refusal the translator produced in their name.
    return {
        primary: message.body,
        original: null,
        label: message.translationStatus === 'pending' ? 'pending' : 'untranslated',
    };
}

/** The customer's languages, as an Agent reads their names. */
const LANGUAGE_NAME: Record<string, string> = { ko: 'Korean', ja: 'Japanese', zh: 'Chinese' };

export interface CustomerReadsView {
    /** Where the translation of this reply stands, from the Agent's side. */
    state: 'translating' | 'checking' | 'reads-as' | 'unchecked' | 'untranslated';
    /** The customer's language, named — "Korean". */
    language: string;
    /** The reply as the customer read it, in English. Only when state is 'reads-as'. */
    readsAs: string | null;
}

/**
 * What an Agent is told about their own reply when it went to the customer in another
 * language — or null when it did not.
 *
 * An Agent cannot read the Korean their English became, so on its own "Machine-translated"
 * tells them nothing about whether it said what they meant. "im handsome too" reached a
 * customer as "(you're) handsome". Translated back, the drift is visible, and the Agent can
 * say it again.
 */
export function customerReadsView(
    message: TranslatableMessage & { backTranslatedBody?: string | null },
): CustomerReadsView | null {
    if (message.senderType !== 'agent') return null;
    if (!message.translatedLang || message.translatedLang === AGENT_LANG) return null;

    const language = LANGUAGE_NAME[message.translatedLang] ?? message.translatedLang;

    switch (message.translationStatus) {
        case 'pending':
            return { state: 'translating', language, readsAs: null };
        case 'untranslated':
            return { state: 'untranslated', language, readsAs: null };
        case 'translated':
            if (message.backTranslatedBody) return { state: 'reads-as', language, readsAs: message.backTranslatedBody };
            if (message.backTranslatedBody === '') return { state: 'unchecked', language, readsAs: null };
            return { state: 'checking', language, readsAs: null };
        default:
            return null;
    }
}

function isForThisReader(message: TranslatableMessage, readerIsAgent: boolean): boolean {
    if (message.translatedLang) {
        const forAgent = message.translatedLang === AGENT_LANG;
        return readerIsAgent ? forAgent : !forAgent;
    }
    // A row that predates the language being recorded up front. The table requires a
    // language on every translated row, so this is only ever pending or untranslated; fall
    // back to the direction every such row had then — inbound for the Agent, outbound for
    // the customer.
    return readerIsAgent ? message.senderType === 'guest' : message.senderType === 'agent';
}
