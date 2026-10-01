/**
 * Which Help Page article answers what a customer is typing (ADR-0043).
 *
 * The widget offers these below the composer while someone writes their first message. They
 * are never posted into the chat and never attributed to anyone: only a person answers inside
 * a Support Chat (ADR-0031). A miss shows nothing — silence beats a confident wrong card.
 *
 * Matching is deterministic and lives in code beside the articles it points at, so a change to
 * either is one deploy and one review. There is no model here and there is not meant to be: the
 * text a customer reads was written by a person and translated once, which is the whole reason
 * this is allowed to exist at all.
 */

/** An article id under `help.sections` in the locale files. */
export type SuggestionId = 'confirmation' | 'refunds' | 'changes' | 'priceGap' | 'payment';

/** Most cards shown at once. A cap, not a target — three would be a wall of links. */
export const MAX_SUGGESTIONS = 2;

/**
 * Shortest message worth matching. Below this a customer is mid-word — "ref" is refund, refuse
 * and reference — and an offer that lands before the question does reads as an interruption.
 */
export const MIN_QUERY_LENGTH = 12;

/**
 * Phrases that mean an article, per language.
 *
 * Deliberately narrow. A phrase that fires on half the queue is worse than no phrase: the cost
 * of a miss is the customer sending a message, which is what they were doing anyway, while the
 * cost of a wrong card is a customer being handed a leaflet about check-in times when their
 * card has been charged twice.
 *
 * Korean and Japanese are matched on substrings rather than words because neither writes spaces
 * between them; the phrases are chosen to be long enough that a substring hit means something.
 */
const TRIGGERS: Record<SuggestionId, Record<string, string[]>> = {
    confirmation: {
        en: ['no confirmation', 'not received confirmation', 'confirmation email', 'no email', 'booking not showing', 'not in my trips', 'where is my booking', 'no voucher', 'missing voucher'],
        ko: ['예약 확인', '확인 메일', '확인메일', '이메일이 안', '메일이 안', '예약이 안 보', '바우처'],
        ja: ['予約確認', '確認メール', 'メールが届', '予約が表示', 'バウチャー'],
        zh: ['确认邮件', '没有收到确认', '预订没有显示', '订单没有显示', '凭证'],
    },
    refunds: {
        en: ['refund', 'money back', 'when do i get my money', 'not refunded', 'refund still'],
        ko: ['환불', '돈을 돌려', '입금이 안'],
        ja: ['返金', 'お金が戻'],
        zh: ['退款', '退钱', '钱还没'],
    },
    changes: {
        en: ['cancel my booking', 'cancel my flight', 'cancel my hotel', 'change my booking', 'change my flight', 'change the date', 'change my dates', 'reschedule', 'amend my booking'],
        ko: ['예약 취소', '취소하고', '항공편 취소', '날짜 변경', '일정 변경'],
        ja: ['予約をキャンセル', 'キャンセルしたい', '日程を変更', '変更したい'],
        zh: ['取消预订', '取消订单', '想取消', '更改日期', '修改预订'],
    },
    priceGap: {
        en: ['price changed', 'price is different', 'cheaper on', 'more expensive at checkout', 'price went up', 'different price'],
        ko: ['가격이 다르', '가격이 올라', '결제 금액이 다르'],
        ja: ['料金が違', '値段が違', '価格が上が'],
        zh: ['价格不一样', '价格变了', '结账价格'],
    },
    payment: {
        en: ['charged twice', 'double charge', 'payment failed', 'card declined', 'card was charged', 'paid but', 'two charges'],
        ko: ['두 번 결제', '중복 결제', '결제 실패', '카드가 거절', '결제가 안'],
        ja: ['二重請求', '二回請求', '決済に失敗', 'カードが使えない', '支払いできない'],
        zh: ['扣款两次', '重复扣款', '支付失败', '银行卡被拒', '付款失败'],
    },
};

/**
 * An article whose answer is a person's job whatever the words say.
 *
 * "Charged twice" matches `payment`, and the Help Page does say when a pending authorisation
 * clears — but a customer who believes they have paid twice for one trip is not asking a
 * general question, and handing them an article instead of a person is how a support tool earns
 * its reputation. The card is withheld and the message goes to the queue like any other.
 */
const NEVER_SUGGEST: Record<string, string[]> = {
    en: ['charged twice', 'double charge', 'two charges', 'charged me twice', 'fraud', 'stolen', 'unauthorised', 'unauthorized', 'chargeback', 'lawyer', 'legal action'],
    ko: ['두 번 결제', '중복 결제', '도용', '사기', '법적'],
    ja: ['二重請求', '二回請求', '不正利用', '詐欺', '法的'],
    zh: ['扣款两次', '重复扣款', '盗刷', '欺诈', '法律'],
};

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** The locale's phrases, plus English — a Korean customer may well type "refund". */
function phrasesFor(map: Record<string, string[]>, locale: string): string[] {
    const own = map[locale] ?? [];
    return locale === 'en' ? own : [...own, ...(map.en ?? [])];
}

/**
 * The articles to offer for what has been typed so far, best match first, at most
 * MAX_SUGGESTIONS. Empty when nothing matches, when the message is too short to mean anything,
 * or when the subject is one only a person should answer.
 */
export function suggestionsFor(query: string, locale: string): SuggestionId[] {
    const text = normalise(query);
    if (text.length < MIN_QUERY_LENGTH) return [];

    for (const phrase of phrasesFor(NEVER_SUGGEST, locale)) {
        if (text.includes(normalise(phrase))) return [];
    }

    const scored: { id: SuggestionId; score: number }[] = [];
    for (const [id, byLocale] of Object.entries(TRIGGERS) as [SuggestionId, Record<string, string[]>][]) {
        // The longest matching phrase wins: "cancel my booking" is a better reason to show the
        // changes article than the word "cancel" inside it would be.
        const best = phrasesFor(byLocale, locale)
            .filter(phrase => text.includes(normalise(phrase)))
            .reduce((longest, phrase) => Math.max(longest, phrase.length), 0);
        if (best > 0) scored.push({ id, score: best });
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SUGGESTIONS)
        .map(match => match.id);
}

/**
 * The questions an empty chat opens with, in the order a customer meets them (ADR-0044).
 *
 * Five is the cap: past that a customer reads a menu instead of recognising their question, and
 * the fifth is here because a payment problem is the one people look for first and must never be
 * answered by a machine — tapping it goes straight to a person.
 */
export const QUICK_QUESTIONS: SuggestionId[] = ['confirmation', 'refunds', 'changes', 'priceGap', 'payment'];

/**
 * Questions only a person answers, however well the article reads.
 *
 * A customer who believes they have been charged twice is not asking a general question about
 * pending authorisations, and handing them an article is how a support tool earns its
 * reputation. Tapping this chip writes their question and calls an Agent.
 */
export const ALWAYS_A_PERSON: SuggestionId[] = ['payment'];

/** What happened to a card that was shown. Recorded so the guessing above can be corrected. */
export type SuggestionOutcome = 'shown' | 'opened' | 'solved' | 'sent_anyway';

export const SUGGESTION_OUTCOMES: SuggestionOutcome[] = ['shown', 'opened', 'solved', 'sent_anyway'];

export function isSuggestionId(value: unknown): value is SuggestionId {
    return typeof value === 'string' && value in TRIGGERS;
}

export function isSuggestionOutcome(value: unknown): value is SuggestionOutcome {
    return typeof value === 'string' && (SUGGESTION_OUTCOMES as string[]).includes(value);
}
