// src/features/golf-api-demo/types.ts
/**
 * The Golf Mock API's own shapes (api-v2 `src/mock-golf/`), kept separate from
 * `@/features/golf/types` on purpose: that file describes the real, production golf module this
 * one does not touch. Duplicating a handful of fields here is cheaper than coupling a sales-demo
 * page to the real booking flow's types.
 */

export const MOCK_SCENARIOS = [
    'ok', 'price_up', 'price_down', 'sold_out', 'hold_timeout',
    'book_rejected', 'book_timeout', 'cancel_rejected', 'cancel_timeout',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export interface MockCourse {
    id:           string;
    slug:         string;
    name:         string;
    country:      string;
    city:         string;
    holes:        number;
    par?:         number | null;
    greenFeeFrom: number | null;
    currency:     string;
    amenities?:   string[];
    status?:      string;
    description?: string;
    extras?:      Array<{ code: string; price: number }>;
}

export interface MockTeeTime {
    id:             string;
    startsAt:       string;
    localTime:      string;
    spotsLeft:      number;
    pricePerPlayer: number;
    currency:       string;
    holes?:         number;
}

export interface MockAvailability {
    courseId:   string;
    courseSlug?: string;
    timezone:   string;
    date:       string;
    firstDate?: string;
    lastDate?:  string;
    players:    number;
    teeTimes:   MockTeeTime[];
}

export interface MockHold {
    holdId:         string;
    reference:      string;
    expiresAt:      string;
    spotsHeld:      number;
    pricePerPlayer: number;
    currency:       string;
    greenFeeTotal:  number;
    extrasTotal:    number;
    total:          number;
    status:         'held';
}

export interface MockBooking {
    bookingId:      string;
    reference:      string;
    status:         'held' | 'confirmed' | 'declined' | 'cancelled' | 'expired';
    courseId:       string;
    teeTimeId:      string;
    startsAt:       string;
    players:        number;
    leadName:       string;
    contactEmail:   string;
    currency:       string;
    total:          number;
    /** What `total` is made of. Optional: older responses (before this field existed) lack it. */
    greenFeeTotal?: number;
    extrasTotal?:   number;
    serviceFee?:    number;
    /** Whether cancelling this booking right now would succeed. */
    cancellable?:   boolean;
}

export interface MockCancelResult {
    bookingId:      string;
    reference:      string;
    status:         'cancelled';
    refundEligible: boolean;
    refundAmount?:  number;
    currency?:      string;
    cancelledAt:    string;
}

export const GOLF_SERVICE_CATEGORIES = [
    'lesson', 'club_fitting', 'equipment', 'tournament', 'membership', 'simulation', 'event',
] as const;
export type GolfServiceCategory = (typeof GOLF_SERVICE_CATEGORIES)[number];
export type GolfServiceBookingMode = 'product' | 'appointment' | 'inquiry';

export const SERVICE_CATEGORY_LABEL: Record<GolfServiceCategory, string> = {
    lesson: 'Golf lessons', club_fitting: 'Club fitting', equipment: 'Equipment', tournament: 'Tournaments',
    membership: 'Memberships', simulation: 'Golf simulation', event: 'Golf events',
};

/** Same catalog on every course — see api-v2's `src/lib/golf/providers/mock/services.ts`. */
export interface MockService {
    id:          string;
    category:    GolfServiceCategory;
    bookingMode: GolfServiceBookingMode;
    name:        string;
    description: string;
    price:       number | null;
    currency:    string;
    unit:        string;
}

export interface MockServiceBooking {
    id:            string;
    reference:     string;
    serviceId:     string;
    category:      GolfServiceCategory;
    bookingMode:   GolfServiceBookingMode;
    name:          string;
    leadName:      string;
    contactEmail:  string;
    courseId?:     string;
    quantity?:     number;
    preferredDate?: string;
    partySize?:    number;
    notes?:        string;
    /** Family Membership only (`membership-family`) — replaces `partySize` for that one service. */
    adults?:       number;
    juniors?:      number;
    /** The catalog's own currency — always USD. Never changed by a display-currency request. */
    currency:      string;
    unitPrice:     number | null;
    total:         number | null;
    /** Present only when a non-USD currency was requested at booking time and conversion succeeded. */
    displayCurrency?:  string;
    displayUnitPrice?: number | null;
    displayTotal?:     number | null;
    status:        'confirmed' | 'cancelled';
    createdAt:     string;
    cancelledAt?:  string | null;
}

/** One call made against the mock API, for the demo page's own "what just happened" log. */
export interface MockCallLogEntry {
    id:       string;
    method:   string;
    path:     string;
    status:   number | 'error';
    request?: unknown;
    response: unknown;
    at:       string;
}
