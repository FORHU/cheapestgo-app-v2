// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    role: 'user' | 'admin';
    firstName?: string;
    lastName?: string;
    avatar?: string;
}

export type AuthStep = 'email' | 'password' | 'register' | 'verify-email' | 'forgot-password';

// ─── Search / Destinations ────────────────────────────────────────────────────

export interface Destination {
    type: 'city' | 'airport' | 'history' | 'country';
    title: string;
    subtitle: string;
    code?: string;
    countryCode?: string;
    id?: string;
    lowestPrice?: number;
    priceCurrency?: string;
}

export interface DateRange {
    checkIn: Date | null;
    checkOut: Date | null;
    flexibility: 'exact' | '1day' | '2days' | '3days' | '7days';
}

export interface RoomOccupancy {
    adults: number;
    childrenAges: number[];
}

export interface TravelersConfig {
    adults: number;
    children: number;
    rooms: number;
    occupancies?: RoomOccupancy[];
}

export interface SearchFilters {
    hotelName: string;
    starRating: number[];
    minRating: number;
    minReviewsCount: number;
    facilities: number[];
    strictFacilityFiltering: boolean;
    propertyTypes: string[];
    boardTypes: string[];
    refundable: boolean | null;
}

// ─── Flights ──────────────────────────────────────────────────────────────────

export interface FlightSegment {
    id: string;
    origin: Destination | null;
    destination: Destination | null;
    date: Date | null;
}

export interface FlightState {
    tripType: 'one-way' | 'round-trip' | 'multi-city';
    cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
    flights: FlightSegment[];
    passengers: {
        adults: number;
        children: number;
        infants: number;
    };
}

export interface FlightOffer {
    id: string;
    totalAmount: string;
    totalCurrency: string;
    slices: FlightSlice[];
    passengers: FlightPassenger[];
}

export interface FlightSlice {
    id: string;
    origin: FlightAirport;
    destination: FlightAirport;
    duration: number;
    segments: FlightSegmentData[];
    departureAt: string;
    arrivalAt: string;
}

export interface FlightSegmentData {
    id: string;
    origin: FlightAirport;
    destination: FlightAirport;
    departingAt: string;
    arrivingAt: string;
    duration: number;
    operatingCarrierFlightNumber: string;
    marketingCarrier: Carrier;
    operatingCarrier: Carrier;
    aircraft: { iataCode: string; name: string };
}

export interface FlightAirport {
    iataCode: string;
    name: string;
    cityName: string;
    countryName: string;
    timeZone?: string;
}

export interface Carrier {
    iataCode: string;
    name: string;
    logoSymbolUrl?: string;
    logotype_url?: string;
}

export interface FlightPassenger {
    id: string;
    type: 'adult' | 'child' | 'infant_without_seat';
    baggageAllowance?: { quantity: number; type: string };
}

// ─── Hotels / Properties ──────────────────────────────────────────────────────

export interface Property {
    id: string;
    name: string;
    address: string;
    city: string;
    country: string;
    starRating?: number;
    reviewScore?: number;
    reviewCount?: number;
    images?: string[];
    coordinates?: { lat: number; lng: number };
    propertyType?: string;
}

export interface HotelOffer {
    offerId: string;
    hotelId: string;
    name: string;
    price: number;
    currency: string;
    boardType?: string;
    cancellationPolicy?: string;
    refundable?: boolean;
    roomName?: string;
    checkIn: string;
    checkOut: string;
    images?: string[];
    starRating?: number;
    reviewScore?: number;
    coordinates?: { lat: number; lng: number };
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';

export type HotelBookingStatus =
    | 'pending'
    | 'confirmed'
    | 'completed'
    | 'cancelled'
    | 'cancelled_refunded'
    | 'cancelled_refund_failed';

export type FlightBookingStatus =
    | 'booked'
    | 'pnr_created'
    | 'awaiting_ticket'
    | 'ticketed'
    | 'failed'
    | 'cancel_requested'
    | 'cancel_failed'
    | 'cancelled'
    | 'refund_pending'
    | 'refund_failed'
    | 'refunded'
    | 'cancelled_provider_missing';

export interface Booking {
    id: string;
    userId: string;
    type: 'flight' | 'hotel';
    status: BookingStatus;
    totalAmount: number;
    currency: string;
    createdAt: string;
    reference?: string;
}

/** Extended hotel booking as returned by GET /api/bookings */
export interface HotelBooking {
    id: string;
    type: 'hotel';
    status: HotelBookingStatus;
    booking_id?: string;
    property_name: string;
    property_image?: string;
    room_name?: string;
    check_in: string;
    check_out: string;
    guests_adults: number;
    guests_children: number;
    total_price: number;
    currency: string;
    created_at: string;
    holder_first_name?: string;
    holder_last_name?: string;
    holder_email?: string;
    special_requests?: string;
    cancellation_policy?: {
        refundableTag?: string;
        cancelPolicyInfos?: Array<{ cancelTime: string; amount: number; currency?: string }>;
        hotelRemarks?: string[];
    };
    provider?: string;
}

/** Extended flight booking as returned by GET /api/bookings */
export interface FlightBooking {
    id: string;
    type: 'flight';
    status: FlightBookingStatus;
    pnr?: string;
    trip_type?: 'one-way' | 'round-trip' | 'multi-city';
    total_price: number;
    charged_price?: number;
    currency: string;
    created_at: string;
    provider?: string;
    flight_segments?: Array<{
        origin: string;
        destination: string;
        departure: string;
        arrival?: string;
        airline?: string;
        flight_number?: string;
    }>;
    passengers?: Array<{
        first_name: string;
        last_name: string;
        type?: string;
        ticket_number?: string;
        seat_number?: string;
    }>;
    fare_policy?: {
        isRefundable?: boolean;
        isChangeable?: boolean;
        refundPenaltyAmount?: number;
        refundPenaltyCurrency?: string;
    };
}

export type AnyBooking = HotelBooking | FlightBooking;

/** Saved / wishlisted item */
export interface SavedTrip {
    id: string;
    type: 'flight' | 'hotel';
    title: string;
    subtitle?: string;
    price?: number;
    currency: string;
    image_url?: string;
    deep_link: string;
    created_at: string;
}

/** Price alert */
export interface PriceAlert {
    id: string;
    type: 'flight' | 'hotel';
    title: string;
    destination?: string;
    threshold_price?: number;
    currency: string;
    created_at: string;
}

/** User preferences */
export interface UserPreferences {
    currency?: string;
    language?: string;
    email_notifications?: boolean;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
