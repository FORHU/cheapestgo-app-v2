/**
 * What the widget reads, as api-v2 sends it.
 *
 * `sender` is renamed to `senderType` on the way in (see `support.api.ts`) so the shared
 * translation rule can read the same field name the inbox does — one rule, two readers, and
 * no chance of them drifting apart over a field name.
 */

export interface SupportConversationView {
    id:        string;
    /** The Chat Reference a customer quotes when they write in about the chat itself. */
    reference: string;
    status:    string;
    locale:    string;
    createdAt: string;
    updatedAt: string;
}

/**
 * A file on a message.
 *
 * Named by id, never by a URL or a storage key (ADR-0040): the bytes are fetched through a
 * route that re-checks entitlement and redirects to a five-minute signed URL, so there is
 * nothing here that keeps working once it should not.
 */
export interface SupportAttachmentView {
    id:             string;
    fileName:       string;
    contentType:    string;
    sizeBytes:      number;
    uploadedByType: 'guest' | 'agent';
    /** The bytes are past their retention window. The transcript still shows the file was sent. */
    bytesDeleted:   boolean;
}

export interface SupportMessageView {
    id:         string;
    senderType: string;
    body:       string;
    noticeCode: string | null;
    /** The stored rendering beside the author's words, never recomputed on read (ADR-0033). */
    translatedBody:    string | null;
    translatedLang:    string | null;
    translationStatus: 'pending' | 'translated' | 'untranslated' | null;
    createdAt:  string;
    attachments?: SupportAttachmentView[];
    /** Set only on a message this tab is still sending; the server never sends it. */
    pending?:   boolean;
}

/** Whether a person can be reached right now, and when they next can. */
export interface SupportAvailability {
    humanAvailable: boolean;
    /** Whether a bucket is configured at all; false hides the paperclip. */
    attachments?:   boolean;
    hours: {
        timezone: string;
        days: Record<string, { open: string; close: string } | null>;
    };
    /** Shaped as `ReopenOpening` in `lib/reopenTime`, which turns it into something to read. */
    nextOpening: {
        day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
        open: string;
        timezone: string;
        today: boolean;
    } | null;
}
