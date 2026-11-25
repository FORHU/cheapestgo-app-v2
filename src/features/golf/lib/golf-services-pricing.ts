// src/features/golf/lib/golf-services-pricing.ts
/**
 * The one calculation this feature uses for a selected Golf Service's line total and for the
 * combined total on the real booking page — the live summary and the booking submission both
 * derive from the exact same `golfServiceLineTotal`/`golfServicesTotal`, so they can never
 * disagree. Entirely about api-v2's separate Golf Services mock catalog
 * (`@/features/golf-api-demo`), never about the real tee time's own green fee/extras/service fee.
 */
import type { MockService, MockServiceBooking } from '@/features/golf-api-demo/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SelectedGolfService {
    serviceId:      string;
    /** Product: how many of the item. Appointment: hours/sessions. Priced inquiry: entries/teams. */
    quantity:       number;
    preferredDate?: string;
    partySize?:     number;
    notes?:         string;
    /** Family Membership only (`FAMILY_MEMBERSHIP_ID`) — replaces `partySize` for that one service. */
    adults?:        number;
    juniors?:       number;
}

/**
 * The one membership priced per member rather than flat. Scoped to this exact catalog id on
 * purpose — every check below leaves Individual Membership and every other service exactly as
 * they were. Mirrors api-v2's `MockGolfServicesStore.FAMILY_MEMBERSHIP_ID`.
 */
export const FAMILY_MEMBERSHIP_ID = 'membership-family';

/**
 * Whether booking this service needs a preferred date at all — every appointment (lessons,
 * fitting, simulation all run on a schedule) and every inquiry (a tournament entry, a corporate
 * event, and a membership's own start date are all for a specific date — no inquiry category is
 * exempt). Only a product (equipment) has no date to pick. Mirrors api-v2's
 * `MockGolfServicesStore.requiresPreferredDate` exactly — the two apps don't share code, so this
 * has to be kept in sync by hand if that rule ever changes.
 */
export function golfServiceRequiresPreferredDate(service: MockService): boolean {
    return service.bookingMode === 'appointment' || service.bookingMode === 'inquiry';
}

/**
 * A courtesy pre-check so the customer sees a problem before submitting, never the sole gate —
 * api-v2 validates the exact same rule (real calendar date, not in the past) and refuses the
 * request regardless of what the frontend thinks.
 */
export function isValidFuturePreferredDate(value: string | undefined): boolean {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return value >= new Date().toISOString().slice(0, 10);
}

/**
 * Whether a selection satisfies this service's own date requirement. Mirrors api-v2 exactly: a
 * required date must be valid; an optional one (e.g. a membership's start date) may be left
 * empty, but if something was entered it still has to be a real, non-past date — never garbage
 * silently accepted just because the field wasn't mandatory.
 */
export function golfServiceDateIsValid(service: MockService, selection: SelectedGolfService): boolean {
    if (golfServiceRequiresPreferredDate(service)) return isValidFuturePreferredDate(selection.preferredDate);
    return !selection.preferredDate || isValidFuturePreferredDate(selection.preferredDate);
}

/**
 * Whether booking this service needs a participant count — a tournament entry and a corporate
 * event both need a headcount to be a real request; a membership doesn't (its own `quantity` is
 * already the member count). Mirrors api-v2's `MockGolfServicesStore.requiresPartySize` exactly.
 */
export function golfServiceRequiresPartySize(service: MockService): boolean {
    return service.category === 'tournament' || service.category === 'event';
}

function isValidPartySize(value: number | undefined): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * Whether a selection satisfies this service's own participant-count requirement. Mirrors api-v2
 * exactly: required for tournaments/events (a positive whole number); optional elsewhere, but if
 * something was entered it still has to be a positive whole number.
 */
export function golfServicePartySizeIsValid(service: MockService, selection: SelectedGolfService): boolean {
    if (golfServiceRequiresPartySize(service)) return isValidPartySize(selection.partySize);
    return selection.partySize === undefined || isValidPartySize(selection.partySize);
}

/**
 * A technical sanity bound on adults/juniors — not a membership-package limit — the same role
 * the picker's partySize field's own max(500) plays for every other service.
 */
const FAMILY_MEMBER_COUNT_MAX = 500;

/**
 * Whether a selection's adults/juniors counts are valid for the Family Membership: at least one
 * adult, zero or more juniors, both whole numbers — with no membership-package maximum (any
 * actual family size is accepted, up to the technical bound above). Always true for every other
 * service — this never applies outside `FAMILY_MEMBERSHIP_ID`. Mirrors api-v2's own check exactly.
 */
export function golfServiceFamilyMembersIsValid(service: MockService, selection: SelectedGolfService): boolean {
    if (service.id !== FAMILY_MEMBERSHIP_ID) return true;
    const adults = selection.adults ?? 2;
    const juniors = selection.juniors ?? 3;
    return Number.isInteger(adults) && adults >= 1 && adults <= FAMILY_MEMBER_COUNT_MAX
        && Number.isInteger(juniors) && juniors >= 0 && juniors <= FAMILY_MEMBER_COUNT_MAX;
}

export interface GolfServiceLine {
    service:   MockService;
    selection: SelectedGolfService;
    /** null exactly when the service is quote-based (price: null) — excluded from the payable total. */
    lineTotal: number | null;
}

/**
 * A quantity field can sit at 0 or blank for a moment while someone is editing it (clearing it to
 * type a new figure) — floored to 1 here rather than in the input's own onChange, so clearing
 * doesn't immediately snap the field back to "1" and break typing a replacement number.
 */
export function effectiveQuantity(selection: SelectedGolfService): number {
    return Math.max(1, selection.quantity || 1);
}

/** A quote-based service (price: null) has no unit to multiply; every other one does. */
export function golfServiceLineTotal(service: MockService, selection: SelectedGolfService): number | null {
    if (service.price == null) return null;
    if (service.id === FAMILY_MEMBERSHIP_ID) {
        // Priced per selected member, not by quantity — see FAMILY_MEMBERSHIP_ID above.
        const adults = selection.adults ?? 2;
        const juniors = selection.juniors ?? 3;
        return round2((service.price / 5) * (adults + juniors));
    }
    return round2(service.price * effectiveQuantity(selection));
}

export function golfServiceLines(services: MockService[], selected: Record<string, SelectedGolfService>): GolfServiceLine[] {
    const lines: GolfServiceLine[] = [];
    for (const selection of Object.values(selected)) {
        const service = services.find((s) => s.id === selection.serviceId);
        if (!service) continue;
        lines.push({ service, selection, lineTotal: golfServiceLineTotal(service, selection) });
    }
    return lines;
}

/** Every selected priced line, summed; a quote-based line contributes nothing until it is priced. */
export function golfServicesTotal(lines: GolfServiceLine[]): number {
    return round2(lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0));
}

export function hasQuotePendingService(lines: GolfServiceLine[]): boolean {
    return lines.some((l) => l.lineTotal === null);
}

/**
 * What an invoice line's quantity/unit annotation is made of — e.g. "2 × $15.00" for a product,
 * "2 sessions" for an appointment, "15 guests" for a quote-based event. The *numbers* here are
 * the one calculation source (same `effectiveQuantity`/catalog data the total is built from);
 * turning them into localized text is the component layer's job (it has `useTranslations`), so
 * this stays pure and framework-agnostic.
 */
export type GolfServiceUnitNoun = 'entry' | 'team' | 'hour' | 'session' | 'year' | 'item';

export type GolfServiceDetail =
    | { kind: 'product';   quantity: number; unitPrice: number; currency: string }
    | { kind: 'unitCount'; quantity: number; unitNoun: GolfServiceUnitNoun }
    | { kind: 'guests';    partySize: number }
    | { kind: 'familyMembers'; adults: number; juniors: number }
    | { kind: 'none' };

const UNIT_NOUN_BY_PRICE_UNIT: Record<string, GolfServiceUnitNoun> = {
    'per entry': 'entry', 'per team': 'team', 'per hour': 'hour', 'per session': 'session', 'per year': 'year', 'per item': 'item',
};

export function golfServiceDetail(service: MockService, selection: SelectedGolfService): GolfServiceDetail {
    if (service.id === FAMILY_MEMBERSHIP_ID) {
        return { kind: 'familyMembers', adults: selection.adults ?? 2, juniors: selection.juniors ?? 3 };
    }
    if (service.bookingMode === 'product') {
        return { kind: 'product', quantity: effectiveQuantity(selection), unitPrice: service.price ?? 0, currency: service.currency };
    }
    if (service.price == null) {
        // A quote-based inquiry (the two corporate events): no unit to count, only a party size.
        return selection.partySize ? { kind: 'guests', partySize: selection.partySize } : { kind: 'none' };
    }
    return { kind: 'unitCount', quantity: effectiveQuantity(selection), unitNoun: UNIT_NOUN_BY_PRICE_UNIT[service.unit] ?? 'item' };
}

/** One invoice row per selected service, by its actual catalog name — never grouped by category. */
export interface GolfServiceInvoiceLine {
    key:    string;
    name:   string;
    detail: GolfServiceDetail;
    amount: number | null;
}

export function golfServiceInvoiceLines(lines: GolfServiceLine[]): GolfServiceInvoiceLine[] {
    return lines.map((l) => ({
        key: l.service.id, name: l.service.name,
        detail: golfServiceDetail(l.service, l.selection), amount: l.lineTotal,
    }));
}

/** The exact body `golfMockApi.bookService` needs for one selected line. */
export function golfServiceBookingBody(line: GolfServiceLine, lead: { leadName: string; contactEmail: string; courseId?: string; currency?: string }) {
    return {
        leadName:      lead.leadName,
        contactEmail:  lead.contactEmail,
        courseId:      lead.courseId,
        quantity:      effectiveQuantity(line.selection),
        preferredDate: line.selection.preferredDate || undefined,
        partySize:     line.selection.partySize,
        adults:        line.selection.adults,
        juniors:       line.selection.juniors,
        notes:         line.selection.notes || undefined,
        currency:      lead.currency,
    };
}

export type GolfServiceBookingResult =
    | { status: 'booked'; booking: MockServiceBooking }
    | { status: 'failed'; serviceId: string };
