import { describe, it, expect } from 'vitest';
import {
    golfServiceLineTotal, golfServiceLines, golfServicesTotal, hasQuotePendingService,
    golfServiceDetail, golfServiceInvoiceLines,
    golfServiceRequiresPreferredDate, isValidFuturePreferredDate, golfServiceDateIsValid,
    golfServiceRequiresPartySize, golfServicePartySizeIsValid, golfServiceFamilyMembersIsValid,
    golfServiceBookingBody, type SelectedGolfService,
} from '@/features/golf/lib/golf-services-pricing';
import type { MockService } from '@/features/golf-api-demo/types';

const svc = (over: Partial<MockService>): MockService => ({
    id: 'svc', category: 'equipment', bookingMode: 'product', name: 'A thing', description: '',
    price: 15, currency: 'USD', unit: 'per item', ...over,
});

describe('golfServiceLineTotal', () => {
    it('multiplies price by quantity for a product', () => {
        expect(golfServiceLineTotal(svc({ price: 15 }), { serviceId: 'svc', quantity: 2 })).toBe(30);
    });

    it('multiplies price by quantity for a priced inquiry (tournament entries)', () => {
        const medal = svc({ id: 'tournament-monthly-medal', category: 'tournament', bookingMode: 'inquiry', price: 25 });
        expect(golfServiceLineTotal(medal, { serviceId: medal.id, quantity: 1 })).toBe(25);
        expect(golfServiceLineTotal(medal, { serviceId: medal.id, quantity: 3 })).toBe(75);
    });

    it('multiplies a team fee by the number of teams', () => {
        const cup = svc({ id: 'tournament-corporate-cup', category: 'tournament', bookingMode: 'inquiry', price: 150 });
        expect(golfServiceLineTotal(cup, { serviceId: cup.id, quantity: 2 })).toBe(300);
    });

    it('prices a membership at its flat figure for quantity 1', () => {
        const individual = svc({ id: 'membership-individual', category: 'membership', bookingMode: 'inquiry', price: 1200 });
        expect(golfServiceLineTotal(individual, { serviceId: individual.id, quantity: 1 })).toBe(1200);
        const family = svc({ id: 'membership-family', category: 'membership', bookingMode: 'inquiry', price: 2000 });
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1 })).toBe(2000);
    });

    it('returns null for a quote-based service regardless of quantity', () => {
        const event = svc({ id: 'event-corporate-outing', category: 'event', bookingMode: 'inquiry', price: null, unit: 'quote' });
        expect(golfServiceLineTotal(event, { serviceId: event.id, quantity: 5 })).toBeNull();
    });

    it('treats quantity 0 or missing as 1, never multiplying by zero', () => {
        expect(golfServiceLineTotal(svc({ price: 15 }), { serviceId: 'svc', quantity: 0 })).toBe(15);
    });
});

describe('golfServiceLines / golfServicesTotal / hasQuotePendingService', () => {
    const glove = svc({ id: 'equip-glove', price: 15 });
    const medal = svc({ id: 'tournament-monthly-medal', category: 'tournament', bookingMode: 'inquiry', price: 25 });
    const outing = svc({ id: 'event-corporate-outing', category: 'event', bookingMode: 'inquiry', price: null, unit: 'quote' });
    const catalog = [glove, medal, outing];

    it('sums only the selected, priced lines; a quote-based line contributes nothing', () => {
        const selected: Record<string, SelectedGolfService> = {
            [glove.id]: { serviceId: glove.id, quantity: 2 },
            [medal.id]: { serviceId: medal.id, quantity: 1 },
            [outing.id]: { serviceId: outing.id, quantity: 1 },
        };
        const lines = golfServiceLines(catalog, selected);
        expect(lines).toHaveLength(3);
        expect(golfServicesTotal(lines)).toBe(55); // 15×2 + 25 + 0
        expect(hasQuotePendingService(lines)).toBe(true);
    });

    it('is 0 and has no pending quote when nothing is selected', () => {
        const lines = golfServiceLines(catalog, {});
        expect(golfServicesTotal(lines)).toBe(0);
        expect(hasQuotePendingService(lines)).toBe(false);
    });

    it('ignores a selection whose serviceId is not in the catalog (stale selection)', () => {
        const lines = golfServiceLines(catalog, { 'not-a-real-id': { serviceId: 'not-a-real-id', quantity: 1 } });
        expect(lines).toHaveLength(0);
    });
});

describe('golfServiceDetail', () => {
    it('describes a product as quantity × unit price', () => {
        const glove = svc({ id: 'equip-glove', price: 15, currency: 'USD', unit: 'per item' });
        expect(golfServiceDetail(glove, { serviceId: glove.id, quantity: 2 })).toEqual({ kind: 'product', quantity: 2, unitPrice: 15, currency: 'USD' });
    });

    it('describes an appointment or a priced inquiry by its own catalog unit, pluralizable by the component layer', () => {
        const lesson = svc({ id: 'lesson-private-coaching', category: 'lesson', bookingMode: 'appointment', price: 75, unit: 'per hour' });
        expect(golfServiceDetail(lesson, { serviceId: lesson.id, quantity: 2 })).toEqual({ kind: 'unitCount', quantity: 2, unitNoun: 'hour' });

        const medal = svc({ id: 'tournament-monthly-medal', category: 'tournament', bookingMode: 'inquiry', price: 25, unit: 'per entry' });
        expect(golfServiceDetail(medal, { serviceId: medal.id, quantity: 2 })).toEqual({ kind: 'unitCount', quantity: 2, unitNoun: 'entry' });

        const cup = svc({ id: 'tournament-corporate-cup', category: 'tournament', bookingMode: 'inquiry', price: 150, unit: 'per team' });
        expect(golfServiceDetail(cup, { serviceId: cup.id, quantity: 1 })).toEqual({ kind: 'unitCount', quantity: 1, unitNoun: 'team' });

        const membership = svc({ id: 'membership-individual', category: 'membership', bookingMode: 'inquiry', price: 1200, unit: 'per year' });
        expect(golfServiceDetail(membership, { serviceId: membership.id, quantity: 1 })).toEqual({ kind: 'unitCount', quantity: 1, unitNoun: 'year' });
    });

    it('describes the Family Membership by its adults/juniors counts, defaulting to the full package (2 adults, 3 juniors)', () => {
        const family = svc({ id: 'membership-family', category: 'membership', bookingMode: 'inquiry', price: 2000, unit: 'per year' });
        expect(golfServiceDetail(family, { serviceId: family.id, quantity: 1 })).toEqual({ kind: 'familyMembers', adults: 2, juniors: 3 });
        expect(golfServiceDetail(family, { serviceId: family.id, quantity: 1, adults: 1, juniors: 0 })).toEqual({ kind: 'familyMembers', adults: 1, juniors: 0 });
    });

    it('describes a quote-based event by party size, with no price-bearing count', () => {
        const outing = svc({ id: 'event-corporate-outing', category: 'event', bookingMode: 'inquiry', price: null, unit: 'quote' });
        expect(golfServiceDetail(outing, { serviceId: outing.id, quantity: 1, partySize: 15 })).toEqual({ kind: 'guests', partySize: 15 });
    });

    it('has no detail at all for a quote-based event with no party size given', () => {
        const outing = svc({ id: 'event-corporate-outing', category: 'event', bookingMode: 'inquiry', price: null, unit: 'quote' });
        expect(golfServiceDetail(outing, { serviceId: outing.id, quantity: 1 })).toEqual({ kind: 'none' });
    });
});

describe('golfServiceInvoiceLines', () => {
    it('is one row per selected service, by its actual catalog name — never grouped by category', () => {
        const ball = svc({ id: 'equip-balls', category: 'equipment', name: 'Dozen Premium Golf Balls', price: 35 });
        const glove = svc({ id: 'equip-glove', category: 'equipment', name: 'Golf Glove', price: 15 });
        const lines = golfServiceLines([ball, glove], {
            'equip-balls': { serviceId: 'equip-balls', quantity: 1 },
            'equip-glove': { serviceId: 'equip-glove', quantity: 2 },
        });
        const invoice = golfServiceInvoiceLines(lines);
        expect(invoice).toHaveLength(2); // not collapsed into one "Equipment" row
        expect(invoice.find((l) => l.key === 'equip-balls')).toMatchObject({ name: 'Dozen Premium Golf Balls', amount: 35 });
        expect(invoice.find((l) => l.key === 'equip-glove')).toMatchObject({ name: 'Golf Glove', amount: 30 });
    });

    it('keeps a quote-based line\'s amount null — never an invented number in the payable total', () => {
        const outing = svc({ id: 'event-corporate-outing', category: 'event', bookingMode: 'inquiry', name: 'Corporate Golf Outing', price: null, unit: 'quote' });
        const lines = golfServiceLines([outing], { 'event-corporate-outing': { serviceId: outing.id, quantity: 1, partySize: 15 } });
        const invoice = golfServiceInvoiceLines(lines);
        expect(invoice).toEqual([{ key: 'event-corporate-outing', name: 'Corporate Golf Outing', detail: { kind: 'guests', partySize: 15 }, amount: null }]);
    });
});

describe('golfServiceBookingBody', () => {
    it('carries the selection\'s fields plus the lead and course context, one-for-one', () => {
        const line = { service: svc({ id: 'equip-glove' }), selection: { serviceId: 'equip-glove', quantity: 2, preferredDate: '2026-12-05', partySize: 4, notes: 'hi' }, lineTotal: 30 };
        expect(golfServiceBookingBody(line, { leadName: 'Pat', contactEmail: 'pat@example.com', courseId: 'fuji' })).toEqual({
            leadName: 'Pat', contactEmail: 'pat@example.com', courseId: 'fuji',
            quantity: 2, preferredDate: '2026-12-05', partySize: 4, notes: 'hi',
        });
    });

    it('floors a quantity of 0 (a field left mid-edit) to 1, so the request never fails the backend\'s min(1) validation', () => {
        const line = { service: svc({ id: 'equip-glove' }), selection: { serviceId: 'equip-glove', quantity: 0 }, lineTotal: 15 };
        expect(golfServiceBookingBody(line, { leadName: 'Pat', contactEmail: 'pat@example.com' }).quantity).toBe(1);
    });

    it('passes the display currency through, when given', () => {
        const line = { service: svc({ id: 'equip-glove' }), selection: { serviceId: 'equip-glove', quantity: 1 }, lineTotal: 15 };
        expect(golfServiceBookingBody(line, { leadName: 'Pat', contactEmail: 'pat@example.com', currency: 'CNY' }).currency).toBe('CNY');
    });

    it('omits currency when none is given', () => {
        const line = { service: svc({ id: 'equip-glove' }), selection: { serviceId: 'equip-glove', quantity: 1 }, lineTotal: 15 };
        expect(golfServiceBookingBody(line, { leadName: 'Pat', contactEmail: 'pat@example.com' }).currency).toBeUndefined();
    });
});

describe('golfServiceRequiresPreferredDate', () => {
    it('requires a date for every appointment', () => {
        expect(golfServiceRequiresPreferredDate(svc({ bookingMode: 'appointment' }))).toBe(true);
    });

    it('requires a date for every inquiry (tournaments, events, memberships) — no inquiry category is exempt', () => {
        expect(golfServiceRequiresPreferredDate(svc({ bookingMode: 'inquiry', category: 'tournament' }))).toBe(true);
        expect(golfServiceRequiresPreferredDate(svc({ bookingMode: 'inquiry', category: 'event', price: null }))).toBe(true);
        expect(golfServiceRequiresPreferredDate(svc({ bookingMode: 'inquiry', category: 'membership' }))).toBe(true);
    });

    it('does not require a date for a product', () => {
        expect(golfServiceRequiresPreferredDate(svc({ bookingMode: 'product' }))).toBe(false);
    });
});

describe('isValidFuturePreferredDate', () => {
    it('rejects an empty or missing date', () => {
        expect(isValidFuturePreferredDate(undefined)).toBe(false);
        expect(isValidFuturePreferredDate('')).toBe(false);
    });

    it('rejects a malformed or non-existent calendar date', () => {
        expect(isValidFuturePreferredDate('12/02/2026')).toBe(false);
        expect(isValidFuturePreferredDate('not-a-date')).toBe(false);
    });

    it('rejects a date in the past', () => {
        expect(isValidFuturePreferredDate('2020-01-01')).toBe(false);
    });

    it('accepts today and any future date', () => {
        const today = new Date().toISOString().slice(0, 10);
        expect(isValidFuturePreferredDate(today)).toBe(true);
        expect(isValidFuturePreferredDate('2099-12-31')).toBe(true);
    });
});

describe('golfServiceDateIsValid', () => {
    it('is false for a required-date service with no date', () => {
        const lesson = svc({ bookingMode: 'appointment' });
        expect(golfServiceDateIsValid(lesson, { serviceId: 'svc', quantity: 1 })).toBe(false);
        expect(golfServiceDateIsValid(lesson, { serviceId: 'svc', quantity: 1, preferredDate: '' })).toBe(false);
    });

    it('is true once a valid future date is set for a required-date service', () => {
        const lesson = svc({ bookingMode: 'appointment' });
        expect(golfServiceDateIsValid(lesson, { serviceId: 'svc', quantity: 1, preferredDate: '2099-01-01' })).toBe(true);
    });

    it('is false for a required-date service with a past date', () => {
        const medal = svc({ bookingMode: 'inquiry', category: 'tournament' });
        expect(golfServiceDateIsValid(medal, { serviceId: 'svc', quantity: 1, preferredDate: '2020-01-01' })).toBe(false);
    });

    it('is true for a non-required-date service (a product) with no date at all', () => {
        const glove = svc({ bookingMode: 'product' });
        expect(golfServiceDateIsValid(glove, { serviceId: 'svc', quantity: 1 })).toBe(true);
    });

    it('requires a date for a membership too, same as any other inquiry', () => {
        const membership = svc({ bookingMode: 'inquiry', category: 'membership' });
        expect(golfServiceDateIsValid(membership, { serviceId: 'svc', quantity: 1 })).toBe(false);
        expect(golfServiceDateIsValid(membership, { serviceId: 'svc', quantity: 1, preferredDate: '2020-01-01' })).toBe(false);
        expect(golfServiceDateIsValid(membership, { serviceId: 'svc', quantity: 1, preferredDate: '2099-01-01' })).toBe(true);
    });
});

describe('golfServiceRequiresPartySize', () => {
    it('requires a participant count for every tournament and every event', () => {
        expect(golfServiceRequiresPartySize(svc({ bookingMode: 'inquiry', category: 'tournament' }))).toBe(true);
        expect(golfServiceRequiresPartySize(svc({ bookingMode: 'inquiry', category: 'event', price: null }))).toBe(true);
    });

    it('does not require a participant count for a membership', () => {
        expect(golfServiceRequiresPartySize(svc({ bookingMode: 'inquiry', category: 'membership' }))).toBe(false);
    });

    it('does not require a participant count for an appointment or a product', () => {
        expect(golfServiceRequiresPartySize(svc({ bookingMode: 'appointment', category: 'lesson' }))).toBe(false);
        expect(golfServiceRequiresPartySize(svc({ bookingMode: 'product', category: 'equipment' }))).toBe(false);
    });
});

describe('golfServicePartySizeIsValid', () => {
    const medal = svc({ bookingMode: 'inquiry', category: 'tournament' });
    const cup = svc({ bookingMode: 'inquiry', category: 'tournament', unit: 'per team' });
    const outing = svc({ bookingMode: 'inquiry', category: 'event', price: null, unit: 'quote' });
    const membership = svc({ bookingMode: 'inquiry', category: 'membership' });

    it('is false for a required service with no participant count', () => {
        expect(golfServicePartySizeIsValid(medal, { serviceId: 'svc', quantity: 1 })).toBe(false);
        expect(golfServicePartySizeIsValid(outing, { serviceId: 'svc', quantity: 1 })).toBe(false);
    });

    it('rejects zero, negative and decimal participant counts', () => {
        expect(golfServicePartySizeIsValid(medal, { serviceId: 'svc', quantity: 1, partySize: 0 })).toBe(false);
        expect(golfServicePartySizeIsValid(medal, { serviceId: 'svc', quantity: 1, partySize: -4 })).toBe(false);
        expect(golfServicePartySizeIsValid(medal, { serviceId: 'svc', quantity: 1, partySize: 2.5 })).toBe(false);
    });

    it('is true once a valid positive whole number is given', () => {
        expect(golfServicePartySizeIsValid(medal, { serviceId: 'svc', quantity: 1, partySize: 4 })).toBe(true);
        expect(golfServicePartySizeIsValid(outing, { serviceId: 'svc', quantity: 1, partySize: 15 })).toBe(true);
    });

    it('requires a participant count for the Corporate Golf Cup regardless of its own team-count quantity', () => {
        expect(golfServicePartySizeIsValid(cup, { serviceId: 'svc', quantity: 2 })).toBe(false);
        expect(golfServicePartySizeIsValid(cup, { serviceId: 'svc', quantity: 2, partySize: 8 })).toBe(true);
    });

    it('is true for a membership with no participant count, but false if an invalid one was entered anyway', () => {
        expect(golfServicePartySizeIsValid(membership, { serviceId: 'svc', quantity: 1 })).toBe(true);
        expect(golfServicePartySizeIsValid(membership, { serviceId: 'svc', quantity: 1, partySize: 0 })).toBe(false);
        expect(golfServicePartySizeIsValid(membership, { serviceId: 'svc', quantity: 1, partySize: 4 })).toBe(true);
    });
});

describe('Family Membership proportional pricing', () => {
    const family = svc({ id: 'membership-family', category: 'membership', bookingMode: 'inquiry', price: 2000, unit: 'per year' });
    const individual = svc({ id: 'membership-individual', category: 'membership', bookingMode: 'inquiry', price: 1200, unit: 'per year' });

    it('prices the full package (2 adults + 3 juniors, the default) at the catalog figure', () => {
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1 })).toBe(2000);
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 2, juniors: 3 })).toBe(2000);
    });

    it('prices proportionally to the selected adults/juniors — full price divided by 5, times the member count', () => {
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 1, juniors: 0 })).toBe(400); // (2000/5) * 1
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 2, juniors: 0 })).toBe(800); // (2000/5) * 2
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 1, juniors: 3 })).toBe(1600); // (2000/5) * 4
    });

    it('ignores quantity entirely for the Family Membership — only adults/juniors drive the price', () => {
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 7, adults: 1, juniors: 0 })).toBe(400);
    });

    it('scales beyond the reference package with no maximum — more adults/juniors than the old limits', () => {
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 3, juniors: 3 })).toBe(2400); // 6 members
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 4, juniors: 2 })).toBe(2400); // 6 members
        expect(golfServiceLineTotal(family, { serviceId: family.id, quantity: 1, adults: 5, juniors: 5 })).toBe(4000); // 10 members
    });

    it('leaves every other membership (Individual Membership) priced exactly as before', () => {
        expect(golfServiceLineTotal(individual, { serviceId: individual.id, quantity: 1 })).toBe(1200);
        expect(golfServiceLineTotal(individual, { serviceId: individual.id, quantity: 1, adults: 1, juniors: 0 })).toBe(1200);
    });

    it('golfServiceFamilyMembersIsValid accepts the default and any valid combination, with no package maximum', () => {
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1 })).toBe(true);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 1, juniors: 0 })).toBe(true);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 2, juniors: 3 })).toBe(true);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 3, juniors: 3 })).toBe(true);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 4, juniors: 2 })).toBe(true);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 5, juniors: 5 })).toBe(true);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 1, juniors: 7 })).toBe(true);
    });

    it('golfServiceFamilyMembersIsValid rejects missing/zero adults, negative or non-integer counts, and absurdly large ones', () => {
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 0, juniors: 3 })).toBe(false);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: -1, juniors: 3 })).toBe(false);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 2, juniors: -1 })).toBe(false);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 1.5, juniors: 3 })).toBe(false);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 2, juniors: 2.5 })).toBe(false);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 501, juniors: 3 })).toBe(false);
        expect(golfServiceFamilyMembersIsValid(family, { serviceId: family.id, quantity: 1, adults: 2, juniors: 501 })).toBe(false);
    });

    it('golfServiceFamilyMembersIsValid is always true for every other service, including Individual Membership', () => {
        expect(golfServiceFamilyMembersIsValid(individual, { serviceId: individual.id, quantity: 1, adults: 99, juniors: 99 })).toBe(true);
    });

    it('golfServiceBookingBody carries adults/juniors through for the Family Membership', () => {
        const line = { service: family, selection: { serviceId: family.id, quantity: 1, adults: 1, juniors: 2 }, lineTotal: 600 };
        const body = golfServiceBookingBody(line, { leadName: 'Pat', contactEmail: 'pat@example.com' });
        expect(body.adults).toBe(1);
        expect(body.juniors).toBe(2);
    });
});
