/**
 * Who is staying, as the hotel checkout collects it — and the payload that carries it.
 *
 * This replaces three things the page did inline and inconsistently:
 *
 *  - Validation was a hand-written function returning English literals ("Required",
 *    "Invalid email"), so the messages could not be translated and the rules lived nowhere a
 *    test could reach. The messages here are **keys** under `checkout.`, which the component
 *    resolves, and every error is keyed by field (`holder.email`, `coGuests.1.lastName`) so a
 *    form can mark the right input.
 *  - The phone was collected, then dropped on the way out: the page put it in a
 *    `holderPhone` the API's schema did not read. It is part of the payload now, and the
 *    contract fixture in the tests is what notices if the two sides drift apart again.
 *  - Children had no way to be described. A child's age is what a supplier prices and admits
 *    them by, and `0` is a real answer — an infant — not an absent one.
 *
 * Nothing here is a business rule. The API owns what is acceptable; this is the early,
 * friendly version of its refusals.
 */

import { z } from 'zod';

export interface HotelGuestForm {
    holder: {
        firstName: string;
        lastName:  string;
        email:     string;
        /** The dial code, e.g. `+63`, kept apart from the number as the phone control keeps it. */
        phoneCode: string;
        phone:     string;
    };
    /** The other adults: name only. */
    coGuests: Array<{ firstName: string; lastName: string }>;
    /** Each child: an age is required, a name is not. `age` is the raw input, as typed. */
    children: Array<{ firstName: string; lastName: string; age: string }>;
    specialRequests: string;
}

export const DEFAULT_PHONE_CODE = '+63';
export const SPECIAL_REQUESTS_MAX = 500;

export function emptyHotelGuestForm(adults: number, children: number): HotelGuestForm {
    const others = Math.max(0, Math.floor(adults) - 1);
    const kids   = Math.max(0, Math.floor(children));
    return {
        holder:   { firstName: '', lastName: '', email: '', phoneCode: DEFAULT_PHONE_CODE, phone: '' },
        coGuests: Array.from({ length: others }, () => ({ firstName: '', lastName: '' })),
        children: Array.from({ length: kids }, () => ({ firstName: '', lastName: '', age: '' })),
        specialRequests: '',
    };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PUNCTUATION = /[\s().-]/g;

const requiredName = (message: string) => z.string().trim().min(1, message);

const phone = z.string().trim().superRefine((value, ctx) => {
    if (!value) return; // optional
    const digits = value.replace(PHONE_PUNCTUATION, '');
    // E.164 allows up to 15 digits; under six is not a number anyone can be rung on.
    if (!/^\d{6,15}$/.test(digits)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.phoneDigitsOnly' });
    }
});

const age = z.string().trim().superRefine((value, ctx) => {
    const n = Number(value);
    const ok = value !== '' && /^\d{1,2}$/.test(value) && Number.isInteger(n) && n >= 0 && n <= 17;
    if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.ageInvalid' });
});

const schema = z.object({
    holder: z.object({
        firstName: requiredName('validation.firstNameRequired'),
        lastName:  requiredName('validation.lastNameRequired'),
        email:     z.string().trim()
            .min(1, 'validation.fieldRequired')
            .refine((v) => v === '' || EMAIL.test(v), 'validation.emailInvalid'),
        phoneCode: z.string(),
        phone,
    }),
    coGuests: z.array(z.object({
        firstName: requiredName('validation.firstNameRequired'),
        lastName:  requiredName('validation.lastNameRequired'),
    })),
    children: z.array(z.object({
        firstName: z.string(),
        lastName:  z.string(),
        age,
    })),
    specialRequests: z.string().max(SPECIAL_REQUESTS_MAX, 'validation.specialRequestsTooLong'),
});

export type HotelGuestValidation =
    | { ok: true }
    /** Keyed by field path; each value is a message key under `checkout.`. */
    | { ok: false; errors: Record<string, string> };

export function validateHotelGuestForm(form: HotelGuestForm): HotelGuestValidation {
    const parsed = schema.safeParse({
        ...form,
        // Trimmed before measuring: a note of spaces is not 500 characters of request.
        specialRequests: form.specialRequests.trim(),
    });
    if (parsed.success) return { ok: true };

    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        // The first problem with a field is the one to show.
        if (!(key in errors)) errors[key] = issue.message;
    }
    return { ok: false, errors };
}

// ─── The payload ──────────────────────────────────────────────────────────────

export interface HotelGuestPayload {
    holder:           { firstName: string; lastName: string; email: string };
    /** Dial code and number joined; absent when no number was given. */
    holderPhone?:     string;
    /** The holder, then the other adults, then the children — the order the API reads them in. */
    guests:           Array<{ firstName: string; lastName: string; age?: number }>;
    specialRequests?: string;
}

/**
 * What the create-payment and confirm calls both carry about who is staying.
 *
 * Sent at **both**: the confirm call because it always was, and create-payment because that is
 * what lets the server finish the booking from Stripe's authorisation event if this browser
 * never comes back — which it cannot do for a traveller whose details it was never given.
 */
export function buildHotelGuestPayload(form: HotelGuestForm): HotelGuestPayload {
    const trim = (s: string) => s.trim();
    const holder = {
        firstName: trim(form.holder.firstName),
        lastName:  trim(form.holder.lastName),
        email:     trim(form.holder.email),
    };

    const number = trim(form.holder.phone);
    const requests = trim(form.specialRequests);

    return {
        holder,
        ...(number ? { holderPhone: `${trim(form.holder.phoneCode)} ${number}`.trim() } : {}),
        guests: [
            { firstName: holder.firstName, lastName: holder.lastName },
            ...form.coGuests.map((g) => ({ firstName: trim(g.firstName), lastName: trim(g.lastName) })),
            ...form.children.map((c) => ({ firstName: trim(c.firstName), lastName: trim(c.lastName), age: Number(trim(c.age)) })),
        ],
        ...(requests ? { specialRequests: requests } : {}),
    };
}
