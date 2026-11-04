/**
 * A golf course as api-v2 sends it (api-v2 CONTEXT.md, "Golf Course").
 *
 * `greenFeeFrom` arrives already in the currency the page asked for, or in the course's own when it
 * could not be converted; `currency` says which. It is a guide, never a quote, and the browser never
 * converts it (CONTEXT.md, "Display Currency").
 */

export const GOLF_AMENITIES = [
    'caddie', 'cart', 'driving_range', 'putting_green', 'clubhouse',
    'restaurant', 'club_rental', 'pro_shop', 'lessons', 'night_golf',
] as const;
export type GolfAmenity = (typeof GOLF_AMENITIES)[number];

/** What a customer can add to a tee time. */
export const GOLF_EXTRAS = ['club_rental', 'caddie', 'cart', 'lessons', 'range_balls'] as const;
export type GolfExtraCode = (typeof GOLF_EXTRAS)[number];

/** What a customer asked for. */
export interface GolfExtraChoice {
    code:     GolfExtraCode;
    quantity: number;
}

/** What a course offers, per item: in the checkout's currency there, in the course's own on the admin. */
export interface GolfExtraOffer {
    code:  GolfExtraCode;
    price: number;
}

/** A priced line: what the customer pays for it, in the booking's currency. */
export interface GolfExtraLine {
    code:     GolfExtraCode;
    quantity: number;
    total:    number;
}

export const GOLF_HOLES = [9, 18, 27, 36] as const;

export type GolfCourseStatus = 'draft' | 'published';

export interface GolfCourse {
    id:           string;
    slug:         string;
    name:         string;
    country:      string;
    city:         string;
    address:      string | null;
    description:  string;
    holes:        number;
    par:          number | null;
    greenFeeFrom: number | null;
    currency:     string;
    /** In display order; the first is the cover. */
    imageUrls:    string[];
    amenities:    GolfAmenity[];
    status:       GolfCourseStatus;
    createdAt:    string;
    updatedAt:    string;
    /** IANA name; tee times are set on this clock. */
    timezone:     string | null;
    bookingWindowDays: number;
    /** How long before a tee time a customer may still cancel for free. */
    freeCancelHours: number;
    scheduleCount: number;
    /** A time zone and at least one schedule: the course has tee times to show. */
    bookable:     boolean;
}

/** One tee time on the course page. Priced all-in per player in the visitor's currency; null only without a rate. */
export interface TeeTimeOffer {
    id:             string;
    startsAt:       string;
    /** "07:30" on the course's clock. */
    localTime:      string;
    spotsLeft:      number;
    allInPerPlayer: number | null;
    currency:       string | null;
}

/** A course-local day of tee times, and the range of days that can be picked. */
export interface TeeTimeDay {
    timezone:  string;
    date:      string;
    firstDate: string;
    lastDate:  string;
    players:   number;
    teeTimes:  TeeTimeOffer[];
}

export interface TeeTimeSchedule {
    id:              string;
    courseId:        string;
    name:            string;
    /** 0 = Sunday … 6 = Saturday. */
    daysOfWeek:      number[];
    firstTee:        string;
    lastTee:         string;
    intervalMinutes: number;
    spots:           number;
    /** In the course's currency. */
    pricePerPlayer:  number;
    createdAt:       string;
}

/** What the admin's schedule form sends. */
export interface ScheduleDraft {
    name:            string;
    daysOfWeek:      number[];
    firstTee:        string;
    lastTee:         string;
    intervalMinutes: number;
    spots:           number;
    pricePerPlayer:  number;
}

export interface GolfCatalogue {
    courses:   GolfCourse[];
    /** Every country with a published course, for the filter. */
    countries: string[];
}

/** What the admin form sends. An empty slug asks api-v2 to make one from the name and city. */
export interface GolfCourseDraft {
    slug:         string;
    name:         string;
    country:      string;
    city:         string;
    address:      string | null;
    description:  string;
    holes:        number;
    par:          number | null;
    greenFeeFrom: number | null;
    currency:     string;
    imageUrls:    string[];
    amenities:    GolfAmenity[];
    timezone:     string | null;
    bookingWindowDays: number;
    freeCancelHours: number;
}

export interface AdminGolfPage {
    data:       GolfCourse[];
    total:      number;
    page:       number;
    pageSize:   number;
    totalPages: number;
}

export type GolfBookingStatus = 'held' | 'requested' | 'confirmed' | 'expired' | 'declined' | 'cancelled';
export type GolfCloseReason =
    | 'hold_expired' | 'declined_by_team' | 'not_confirmed_in_time'
    | 'cancelled_by_customer' | 'cancelled_by_team';
/** The admin screen's three lists. */
export type GolfBookingList = 'waiting' | 'upcoming' | 'closed';

/** What a tee time would cost this party, in the currency asked for. The figures the card is charged. */
export interface TeeTimeQuote {
    teeTimeId:  string;
    course:     { slug: string; name: string; city: string; country: string; imageUrl: string | null };
    startsAt:   string;
    timezone:   string;
    players:    number;
    spotsLeft:  number;
    currency:   string;
    greenFee:   number;
    /** What was asked for and can be had; api-v2 leaves out the rest. */
    extras:     GolfExtraLine[];
    extrasTotal: number;
    /** Everything the course offers, per item in `currency`. */
    extraOffers: GolfExtraOffer[];
    serviceFee: number;
    total:      number;
    /** Until when this tee time could be cancelled for free, if booked now. */
    freeCancelUntil: string;
}

/** A hold just taken. No client secret means the card was already authorised: only the booking is left to show. */
export interface StartedGolfBooking {
    reference:     string;
    clientSecret:  string | null;
    status:        GolfBookingStatus;
    holdExpiresAt: string;
    currency:      string;
    greenFee:      number;
    extras:        GolfExtraLine[];
    extrasTotal:   number;
    serviceFee:    number;
    total:         number;
}

/** A customer's own booking (api-v2 CONTEXT.md, "Golf Booking"). */
export interface GolfBooking {
    reference:     string;
    teeTimeId:     string;
    status:        GolfBookingStatus;
    closeReason:   GolfCloseReason | null;
    players:       number;
    leadName:      string;
    contactEmail:  string;
    currency:      string;
    greenFee:      number;
    extras:        GolfExtraLine[];
    extrasTotal:   number;
    serviceFee:    number;
    total:         number;
    startsAt:      string;
    holdExpiresAt: string;
    decideBy:      string | null;
    confirmedAt:   string | null;
    createdAt:     string;
    /** Until when it can be cancelled for free. Written on the booking when it was made. */
    freeCancelUntil: string;
    /** What went back to the card, in `currency`. */
    refundAmount:  number;
    /** Whether cancelling works right now: api-v2 decides, so the page need not know the rule. */
    cancellable:   boolean;
    course: {
        slug:     string;
        name:     string;
        city:     string;
        country:  string;
        timezone: string | null;
        imageUrl: string | null;
    };
}

/** The same booking as the team sees it, with what the course asks in its own currency. */
export interface AdminGolfBooking extends Omit<GolfBooking, 'cancellable' | 'extras'> {
    id:             string;
    courseCurrency: string;
    pricePerPlayer: number;
    /** `unitPrice` is what the course asks, in its own currency. */
    extras:         Array<GolfExtraLine & { unitPrice: number }>;
    requestedAt:    string | null;
    closedAt:       string | null;
}

export interface AdminGolfBookingPage {
    data:       AdminGolfBooking[];
    total:      number;
    page:       number;
    pageSize:   number;
    totalPages: number;
}
