import { describe, it, expect } from 'vitest';
import { suggestionsFor, MAX_SUGGESTIONS, MIN_QUERY_LENGTH } from '@/features/support/lib/suggestions';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';
import ja from '@/locales/ja.json';
import zh from '@/locales/zh.json';

/**
 * The matcher behind a Suggested Answer (ADR-0043). It is allowed to miss — a miss costs the
 * customer nothing but the message they were already writing. It is not allowed to be confidently
 * wrong, because a card about check-in times shown to someone whose card was charged twice is
 * worse than no card at all.
 */

describe('suggestionsFor', () => {
    it('offers the article that answers the question', () => {
        expect(suggestionsFor('I booked yesterday but I have no confirmation email', 'en')).toContain('confirmation');
        expect(suggestionsFor('when do I get my refund for the hotel', 'en')).toContain('refunds');
        expect(suggestionsFor('I need to cancel my booking for next week', 'en')).toContain('changes');
        expect(suggestionsFor('the price changed when I got to checkout', 'en')).toContain('priceGap');
    });

    it('answers a Korean customer in Korean, and an English word from one too', () => {
        expect(suggestionsFor('예약 확인 메일이 안 왔어요 확인 부탁드립니다', 'ko')).toContain('confirmation');
        expect(suggestionsFor('환불은 언제 받을 수 있나요? 카드로 결제했습니다', 'ko')).toContain('refunds');
        // Korean customers type English words constantly; the locale's phrases are added to
        // English, never used instead of it.
        expect(suggestionsFor('refund 언제 되나요 카드 결제했어요', 'ko')).toContain('refunds');
    });

    it('answers Japanese and Chinese customers too', () => {
        expect(suggestionsFor('予約確認メールが届きません。確認をお願いします', 'ja')).toContain('confirmation');
        expect(suggestionsFor('我想取消预订，请问可以吗？谢谢', 'zh')).toContain('changes');
    });

    it('says nothing while the customer is still typing a word', () => {
        expect(suggestionsFor('ref', 'en')).toEqual([]);
        expect(suggestionsFor('refund?', 'en')).toEqual([]);
        expect('refund me now'.length).toBeLessThan(MIN_QUERY_LENGTH + 2);
    });

    it('says nothing when nothing matches', () => {
        expect(suggestionsFor('do you have a hotel near Gangnam with a pool', 'en')).toEqual([]);
        expect(suggestionsFor('안녕하세요 좋은 아침입니다 오늘 날씨가 좋네요', 'ko')).toEqual([]);
    });

    it('withholds every card when only a person should answer', () => {
        // The payment article does explain pending authorisations. This customer does not want
        // an article, and handing them one is the thing that makes support tools hated.
        expect(suggestionsFor('you charged twice for one booking, fix this now', 'en')).toEqual([]);
        expect(suggestionsFor('제 카드로 두 번 결제가 됐어요 환불해 주세요', 'ko')).toEqual([]);
        expect(suggestionsFor('this looks like fraud, I will contact my lawyer', 'en')).toEqual([]);
    });

    it('prefers the phrase that says more', () => {
        // "cancel my booking" is a reason to show the changes article; the word "cancellation"
        // inside a refund question is not a reason to show it first.
        const [first] = suggestionsFor('what is the refund on a cancelled hotel booking', 'en');
        expect(first).toBe('refunds');
    });

    it('never shows more than the cap', () => {
        const many = suggestionsFor(
            'I want to cancel my booking and get a refund, and I have no confirmation email, and the price changed',
            'en',
        );
        expect(many.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    });

    it('only ever names an article that exists in every language', () => {
        // A card renders from the locale files; an id with no article behind it is a blank card
        // in front of a customer.
        const ids = [
            ...suggestionsFor('I have no confirmation email for my booking', 'en'),
            ...suggestionsFor('when is my refund coming back to my card', 'en'),
            ...suggestionsFor('I need to change the date of my flight', 'en'),
            ...suggestionsFor('the price is different at checkout than in search', 'en'),
            ...suggestionsFor('my card was charged but nothing happened', 'en'),
        ];
        expect(ids.length).toBeGreaterThan(0);
        for (const id of new Set(ids)) {
            for (const [name, messages] of [['en', en], ['ko', ko], ['ja', ja], ['zh', zh]] as const) {
                type Articles = { help?: { sections?: Record<string, { title?: string; body?: string }> } };
                const section = (messages as Articles).help?.sections?.[id];
                expect(section?.title, `${id} title missing in ${name}`).toBeTruthy();
                expect(section?.body, `${id} body missing in ${name}`).toBeTruthy();
            }
        }
    });
});
