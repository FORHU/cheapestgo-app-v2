import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
    buildHotelGuestPayload,
    emptyHotelGuestForm,
    validateHotelGuestForm,
    type HotelGuestForm,
} from '../hotel-guest-form';

const valid = (over: Partial<HotelGuestForm> = {}): HotelGuestForm => ({
    holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com', phoneCode: '+63', phone: '917 123 4567' },
    coGuests: [{ firstName: 'Maria', lastName: 'dela Cruz' }],
    children: [{ firstName: '', lastName: '', age: '8' }],
    specialRequests: '',
    ...over,
});

describe('emptyHotelGuestForm', () => {
    it('has one slot for each other adult and each child', () => {
        const f = emptyHotelGuestForm(3, 2);
        expect(f.coGuests).toHaveLength(2);
        expect(f.children).toHaveLength(2);
        expect(f.holder.phoneCode).toBe('+63');
    });

    it('never has a negative number of slots', () => {
        expect(emptyHotelGuestForm(0, -1)).toMatchObject({ coGuests: [], children: [] });
    });
});

describe('validateHotelGuestForm', () => {
    it('accepts a complete form', () => {
        expect(validateHotelGuestForm(valid())).toEqual({ ok: true });
    });

    it('asks for the holder\'s name and email, by field', () => {
        const r = validateHotelGuestForm(valid({
            holder: { firstName: ' ', lastName: '', email: '', phoneCode: '+63', phone: '' },
        }));
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.errors).toMatchObject({
                'holder.firstName': 'validation.firstNameRequired',
                'holder.lastName':  'validation.lastNameRequired',
                'holder.email':     'validation.fieldRequired',
            });
        }
    });

    it('rejects an email that is not one', () => {
        const r = validateHotelGuestForm(valid({
            holder: { ...valid().holder, email: 'juan@' },
        }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors['holder.email']).toBe('validation.emailInvalid');
    });

    it('does not insist on a phone, but will not accept nonsense in one', () => {
        expect(validateHotelGuestForm(valid({ holder: { ...valid().holder, phone: '' } }))).toEqual({ ok: true });

        const r = validateHotelGuestForm(valid({ holder: { ...valid().holder, phone: 'call me' } }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors['holder.phone']).toBe('validation.phoneDigitsOnly');
    });

    it('accepts the ways people write a number', () => {
        for (const phone of ['917 123 4567', '(917) 123-4567', '9171234567', '917.123.4567']) {
            expect(validateHotelGuestForm(valid({ holder: { ...valid().holder, phone } }))).toEqual({ ok: true });
        }
    });

    it('names each missing co-guest field by position', () => {
        const r = validateHotelGuestForm(valid({
            coGuests: [{ firstName: 'Maria', lastName: '' }, { firstName: '', lastName: 'dela Cruz' }],
        }));
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.errors).toMatchObject({
                'coGuests.0.lastName':  'validation.lastNameRequired',
                'coGuests.1.firstName': 'validation.firstNameRequired',
            });
        }
    });

    it('requires a child\'s age, as a whole number from 0 to 17', () => {
        const bad = (age: string) => {
            const r = validateHotelGuestForm(valid({ children: [{ firstName: '', lastName: '', age }] }));
            return r.ok ? null : r.errors['children.0.age'];
        };
        expect(bad('')).toBe('validation.ageInvalid');
        expect(bad('18')).toBe('validation.ageInvalid');
        expect(bad('-1')).toBe('validation.ageInvalid');
        expect(bad('7.5')).toBe('validation.ageInvalid');
        expect(bad('abc')).toBe('validation.ageInvalid');
        expect(bad('0')).toBeNull();      // an infant is a valid age, not a missing one
        expect(bad('17')).toBeNull();
    });

    it('does not ask a child for a name', () => {
        expect(validateHotelGuestForm(valid({ children: [{ firstName: '', lastName: '', age: '5' }] }))).toEqual({ ok: true });
    });

    it('caps special requests, which end up on a supplier voucher', () => {
        const r = validateHotelGuestForm(valid({ specialRequests: 'x'.repeat(501) }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors.specialRequests).toBe('validation.specialRequestsTooLong');
    });
});

describe('buildHotelGuestPayload', () => {
    it('sends the holder first, then the other adults, then the children with their ages', () => {
        const p = buildHotelGuestPayload(valid());

        expect(p.holder).toEqual({ firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' });
        expect(p.guests).toEqual([
            { firstName: 'Juan', lastName: 'dela Cruz' },
            { firstName: 'Maria', lastName: 'dela Cruz' },
            { firstName: '', lastName: '', age: 8 },
        ]);
    });

    it('actually sends the phone, joined to its dial code', () => {
        expect(buildHotelGuestPayload(valid()).holderPhone).toBe('+63 917 123 4567');
    });

    it('omits a phone that was left empty rather than sending a bare dial code', () => {
        const p = buildHotelGuestPayload(valid({ holder: { ...valid().holder, phone: '  ' } }));
        expect(p.holderPhone).toBeUndefined();
    });

    it('keeps an infant\'s age of zero', () => {
        const p = buildHotelGuestPayload(valid({ children: [{ firstName: '', lastName: '', age: '0' }] }));
        expect(p.guests.at(-1)).toMatchObject({ age: 0 });
    });

    it('carries special requests, trimmed, and none when empty', () => {
        expect(buildHotelGuestPayload(valid({ specialRequests: '  High floor please  ' })).specialRequests).toBe('High floor please');
        expect(buildHotelGuestPayload(valid({ specialRequests: '   ' })).specialRequests).toBeUndefined();
    });

    it('trims names and email', () => {
        const p = buildHotelGuestPayload(valid({
            holder: { ...valid().holder, firstName: '  Juan ', email: ' juan@example.com ' },
        }));
        expect(p.holder).toMatchObject({ firstName: 'Juan', email: 'juan@example.com' });
    });
});

describe('the payload against the API\'s own schemas', () => {
    // Copied from api-v2 src/controllers/hotels.controller.ts (confirmBooking and createPayment).
    // A fixture rather than an import: the repos are separate, and this is the guard that the
    // two stay in step — if the API's schema changes, this is where it shows.
    const holder = z.object({ firstName: z.string(), lastName: z.string(), email: z.string().email() });
    const guests = z.array(z.object({ firstName: z.string(), lastName: z.string(), age: z.number().optional() }));

    const API_CONFIRM = z.object({
        paymentIntentId: z.string().min(1),
        prebookId:       z.string().min(1),
        holder,
        holderPhone:     z.string().max(40).optional(),
        guests:          guests.optional(),
        checkIn:         z.string(),
        checkOut:        z.string(),
        adults:          z.coerce.number().int().min(1).optional(),
        children:        z.coerce.number().int().min(0).optional(),
        specialRequests: z.string().optional(),
    });

    const API_CREATE_PAYMENT = z.object({
        prebookId:       z.string().min(1),
        amount:          z.coerce.number().positive(),
        currency:        z.string().length(3),
        holder:          holder.optional(),
        holderPhone:     z.string().max(40).optional(),
        guests:          guests.optional(),
        adults:          z.coerce.number().int().min(1).optional(),
        children:        z.coerce.number().int().min(0).optional(),
        specialRequests: z.string().optional(),
    });

    it('parses as a confirm call', () => {
        const p = buildHotelGuestPayload(valid());
        const out = API_CONFIRM.parse({
            paymentIntentId: 'pi_1', prebookId: 'MOCK:x', checkIn: '2026-11-10', checkOut: '2026-11-12',
            adults: 2, children: 1, ...p,
        });
        expect(out.guests).toHaveLength(3);
    });

    it('parses as a create-payment call, so the booking can be finished from the payment event', () => {
        const p = buildHotelGuestPayload(valid());
        expect(() => API_CREATE_PAYMENT.parse({
            prebookId: 'MOCK:x', amount: 240, currency: 'USD', adults: 2, children: 1, ...p,
        })).not.toThrow();
    });
});
