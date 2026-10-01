/**
 * The widget's state, and the one thing that makes it worth a reducer: a message arrives more
 * than once.
 *
 * Its own POST response and the stream both carry the customer's message, and a reply arrives
 * again each time its translation moves on. Every test below is a way that went wrong in v1.
 */

import { describe, it, expect } from 'vitest';
import {
    supportReducer,
    initialSupportState,
    visibleMessages,
    isHeldForTranslation,
    awaitingTranslation,
    type SupportState,
} from '@/features/support/lib/supportReducer';
import type { SupportMessageView } from '@/features/support/types';

const msg = (over: Partial<SupportMessageView> = {}): SupportMessageView => ({
    id: 'm1', senderType: 'agent', body: 'Looking into it now.', noticeCode: null,
    translatedBody: null, translatedLang: null, translationStatus: null,
    createdAt: '2026-09-25T10:00:00.000Z', ...over,
});

const conversation = {
    id: 'c1', reference: 'CG-1234', status: 'waiting_human', locale: 'ko',
    createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T09:00:00.000Z',
};

const openWith = (messages: SupportMessageView[]): SupportState =>
    supportReducer(initialSupportState, { type: 'opened', conversation, messages });

describe('a message arriving twice', () => {
    it('updates the copy on screen rather than adding a second', () => {
        const first  = msg({ translationStatus: 'pending', translatedLang: 'ko' });
        const second = msg({ translationStatus: 'translated', translatedLang: 'ko', translatedBody: '확인 중입니다' });

        let state = supportReducer(openWith([]), { type: 'received', message: first });
        state = supportReducer(state, { type: 'received', message: second });

        expect(state.confirmed).toHaveLength(1);
        expect(state.confirmed[0].translatedBody).toBe('확인 중입니다');
    });

    it('never lets an older copy overwrite a newer one', () => {
        // The POST response can land after the stream has already delivered the row translated.
        const translated = msg({ translationStatus: 'translated', translatedLang: 'ko', translatedBody: '확인 중입니다' });
        const stale      = msg({ translationStatus: null });

        let state = supportReducer(openWith([]), { type: 'received', message: translated });
        state = supportReducer(state, { type: 'received', message: stale });

        expect(state.confirmed[0].translatedBody).toBe('확인 중입니다');
    });

    it('does not count a translation landing as something new to read', () => {
        const pending = msg({ translationStatus: 'pending', translatedLang: 'ko' });
        let state = supportReducer(openWith([]), { type: 'received', message: pending });
        const afterFirst = state.unread;

        state = supportReducer(state, {
            type: 'received',
            message: msg({ translationStatus: 'translated', translatedLang: 'ko', translatedBody: '…' }),
        });

        expect(state.unread).toBe(afterFirst);
    });
});

describe('the customer’s own message', () => {
    it('shows immediately, before the server has confirmed it', () => {
        const state = supportReducer(openWith([]), {
            type: 'sent', clientId: 'x1', body: 'my flight was cancelled', at: '2026-09-25T10:01:00.000Z',
        });
        expect(visibleMessages(state).map(m => m.body)).toEqual(['my flight was cancelled']);
        expect(visibleMessages(state)[0].pending).toBe(true);
    });

    it('is not shown twice when the stream beats the POST response', () => {
        let state = supportReducer(openWith([]), {
            type: 'sent', clientId: 'x1', body: 'my flight was cancelled', at: '2026-09-25T10:01:00.000Z',
        });
        state = supportReducer(state, {
            type: 'received',
            message: msg({ id: 'm9', senderType: 'guest', body: 'my flight was cancelled' }),
        });

        expect(visibleMessages(state)).toHaveLength(1);
        expect(visibleMessages(state)[0].pending).toBeUndefined();
    });

    it('and coming back does not raise the unread badge', () => {
        const closed = supportReducer(openWith([]), { type: 'closed' });
        const state  = supportReducer(closed, {
            type: 'received', message: msg({ id: 'm9', senderType: 'guest', body: 'hello' }),
        });
        expect(state.unread).toBe(0);
    });

    it('disappears when it could not be sent', () => {
        let state = supportReducer(openWith([]), {
            type: 'sent', clientId: 'x1', body: 'hello', at: '2026-09-25T10:01:00.000Z',
        });
        state = supportReducer(state, { type: 'send_failed', clientId: 'x1' });
        expect(visibleMessages(state)).toHaveLength(0);
    });
});

describe('a reply still being translated', () => {
    const held = msg({ id: 'm2', translationStatus: 'pending', translatedLang: 'ko' });

    it('is held back, so the customer does not read it in English first', () => {
        expect(isHeldForTranslation(held)).toBe(true);
        const state = openWith([held]);
        expect(visibleMessages(state)).toHaveLength(0);
        expect(awaitingTranslation(state)).toBe(true);
    });

    it('is shown once the translation settles, even when it failed', () => {
        const settled = msg({ id: 'm2', translationStatus: 'untranslated', translatedLang: 'ko' });
        expect(isHeldForTranslation(settled)).toBe(false);
        expect(visibleMessages(openWith([settled]))).toHaveLength(1);
    });

    it('does not hold the customer’s own message waiting on its English rendering', () => {
        // That English is for the inbox. Holding it would hide someone's own words from them.
        const own = msg({ id: 'm3', senderType: 'guest', body: '제 항공편이 취소되었습니다', translationStatus: 'pending', translatedLang: 'en' });
        expect(isHeldForTranslation(own)).toBe(false);
        expect(visibleMessages(openWith([own]))).toHaveLength(1);
    });
});

describe('where a reconnecting stream resumes', () => {
    it('from the newest message when nothing is held', () => {
        const state = openWith([msg({ id: 'a', createdAt: '2026-09-25T10:00:00.000Z' }),
                                msg({ id: 'b', createdAt: '2026-09-25T10:05:00.000Z' })]);
        expect(state.cursor).toBe('b');
    });

    it('from before the oldest held reply, so its translation is still heard about', () => {
        // Past it, the backfill would never mention the row again and it would stay hidden.
        const state = openWith([
            msg({ id: 'a', createdAt: '2026-09-25T10:00:00.000Z' }),
            msg({ id: 'b', createdAt: '2026-09-25T10:05:00.000Z', translationStatus: 'pending', translatedLang: 'ko' }),
            msg({ id: 'c', createdAt: '2026-09-25T10:06:00.000Z' }),
        ]);
        expect(state.cursor).toBe('a');
    });

    it('from nothing at all when the very first message is held', () => {
        const state = openWith([msg({ id: 'a', translationStatus: 'pending', translatedLang: 'ko' })]);
        expect(state.cursor).toBeNull();
    });
});

describe('the unread badge', () => {
    it('counts what arrived while the panel was shut', () => {
        const shut = supportReducer(openWith([]), { type: 'closed' });
        const state = supportReducer(shut, { type: 'received', message: msg({ id: 'm5' }) });
        expect(state.unread).toBe(1);
    });

    it('clears when the panel is opened, because opening it is reading it', () => {
        const shut  = supportReducer(openWith([]), { type: 'closed' });
        const after = supportReducer(shut, { type: 'received', message: msg({ id: 'm5' }) });
        expect(supportReducer(after, { type: 'opened_panel' }).unread).toBe(0);
    });

    it('stays at nothing while the panel is open', () => {
        const open  = supportReducer(openWith([]), { type: 'opened_panel' });
        const state = supportReducer(open, { type: 'received', message: msg({ id: 'm5' }) });
        expect(state.unread).toBe(0);
    });
});

describe('the transcript', () => {
    it('is ordered by when messages were written, not when they arrived', () => {
        let state = openWith([msg({ id: 'b', createdAt: '2026-09-25T10:05:00.000Z', body: 'second' })]);
        state = supportReducer(state, {
            type: 'received', message: msg({ id: 'a', createdAt: '2026-09-25T10:00:00.000Z', body: 'first' }),
        });
        expect(visibleMessages(state).map(m => m.body)).toEqual(['first', 'second']);
    });
});
