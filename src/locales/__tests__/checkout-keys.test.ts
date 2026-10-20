import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The checkout screens read from the messages, in every language the storefront serves.
 *
 * Checkout is where someone hands over money, so a missing key here does not degrade politely:
 * next-intl falls back to English, and a Korean customer on a Korean domain reads an English
 * word in the middle of a price breakdown. These assertions are about coverage, not wording —
 * the wording of the strings v1 never had is listed in NEEDS_NATIVE_REVIEW.md for a speaker.
 */

type Messages = Record<string, unknown>;
const LANGS: Array<[string, Messages]> = [['ko', ko], ['ja', ja], ['zh', zh]];

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

/** Every key the checkout page asks for. */
const USED = [
    'checkout.booked',
    'checkout.allSet',
    'checkout.receiptSent',
    'checkout.bookingReference',
    'checkout.checkIn',
    'checkout.checkOut',
    'checkout.guestLabel',
    'checkout.priceBreakdown',
    'checkout.serviceFee',
    'checkout.totalPaid',
    'checkout.roomFallback',
    'checkout.nightsCount',
    'checkout.guestsCount',
    'checkout.confirmingFinalPrice',
    'checkout.summary.total',
    'checkout.steps.details',
    'checkout.steps.payment',
    'checkout.steps.confirmed',
    'checkout.steps.verification',
    'checkout.whosCheckingInYou',
    'checkout.paymentDetailsTitle',
    'checkout.securedPoweredBy',
    'checkout.summary.dates',
    'checkout.summary.guests',
    'checkout.summary.room',
    'checkout.payNow',
    'checkout.userDetails.guest1',
    'checkout.userDetails.guestN',

    // The states the checkout can be in that are not the happy path.
    'checkout.priceMoved.title',
    'checkout.priceMoved.up',
    'checkout.priceMoved.down',
    'checkout.priceMoved.was',
    'checkout.priceMoved.now',
    'checkout.priceMoved.accept',
    'checkout.priceMoved.chooseAnother',
    'checkout.priceMoved.refreshing',
    'checkout.unavailable.title',
    'checkout.unavailable.description',
    'checkout.unavailable.chooseAnother',
    'checkout.notPayableOnline.title',
    'checkout.notPayableOnline.description',
    'checkout.notPayableOnline.chooseAnother',
    'checkout.supplierDown.title',
    'checkout.supplierDown.description',
    'checkout.supplierDown.retry',
    'checkout.settling.title',
    'checkout.settling.description',
    'checkout.settling.doNotPayAgain',
    'checkout.settling.checkTrips',
    'checkout.needsReview.title',
    'checkout.needsReview.description',
    'checkout.failed.title',
    'checkout.failed.released',
    'checkout.failed.unknown',
    'checkout.failed.tryAgain',
    'checkout.flight.cardHeld',
    'checkout.flight.priceChanged',
    'checkout.flight.offerExpired',
    'checkout.flight.settling.description',
    'checkout.flight.needsReview.title',
    'checkout.flight.needsReview.description',
    'checkout.flight.adultN',
    'checkout.flight.infantN',
    'checkout.flight.nameHint',
    'checkout.flight.contactHint',
    'checkout.flight.countryPlaceholder',
    'checkout.flight.countryNoResults',
    'checkout.flight.passportPlaceholder',
    'checkout.flight.whosFlying',
    'checkout.signInToComplete',
    'checkout.signInBannerDesc',
    'checkout.signInArrow',
    'checkout.continueToPayment',
    'checkout.completeYourBooking',
    'checkout.userDetails.childN',
    'checkout.userDetails.firstName',
    'checkout.userDetails.lastName',
    'checkout.userDetails.email',
    'checkout.userDetails.phoneNumber',
    'checkout.userDetails.phonePlaceholder',
    'checkout.userDetails.dateOfBirth',
    'checkout.userDetails.gender',
    'checkout.userDetails.passportNumber',
    'checkout.userDetails.passportExpiry',
    'checkout.userDetails.country',
    'checkout.multiRoom.title',
    'checkout.multiRoom.description',
    'checkout.bookingPage.loading',
    'checkout.bookingPage.notFound',
    'checkout.bookingPage.notFoundDescription',
    'checkout.bookingPage.reference',
    'checkout.bookingPage.refresh',
    'checkout.bookingPage.viewTrips',
    'checkout.bookingPage.stillWorking',
    'checkout.validation.emailInvalid',
    'checkout.validation.ageInvalid',
    'checkout.validation.specialRequestsTooLong',
];

describe('checkout messages', () => {
    it.each(USED)('%s exists in English', (path) => {
        expect(read(en, path)).toBeTypeOf('string');
    });

    it.each(LANGS)('%s translates every checkout key the page uses', (lang, messages) => {
        const missing = USED.filter((path) => typeof read(messages, path) !== 'string');
        expect(missing, `${lang} is missing:\n${missing.join('\n')}`).toEqual([]);
    });

    it.each(LANGS)('%s is not simply the English string', (lang, messages) => {
        // A key present but untranslated reads as covered while showing English. Prices and
        // placeholders legitimately match, so only prose is checked.
        const prose = ['checkout.allSet', 'checkout.bookingReference', 'checkout.serviceFee', 'checkout.totalPaid'];
        for (const path of prose) {
            expect(read(messages, path), `${lang} ${path}`).not.toBe(read(en, path));
        }
    });

    it('states the plural rule in the message rather than in the component', () => {
        // `{n} night{n !== 1 ? 's' : ''}` is an English rule written in TypeScript. Korean,
        // Japanese and Chinese do not inflect for number, and a language that does needs its
        // own rule — so the count carries it.
        expect(read(en, 'checkout.nightsCount')).toContain('plural');
        expect(read(ko, 'checkout.nightsCount')).toContain('{count}');
    });
});
