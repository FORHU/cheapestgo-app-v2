export interface RateRow {
    offerId: string;
    price: number;
    currency: string;
    boardCode?: string;
    boardName?: string;
    refundable: boolean;
    refundableTag: string;
    cancellationDeadline?: string;
}

export interface RoomOption {
    id: string;
    offerId?: string;
    name: string;
    price: number;        // lowest rate price (total stay)
    currency: string;
    refundableTag?: string;
    boardType?: string;
    boardName?: string;
    maxOccupancy?: number;
    bedType?: string;
    size?: number;
    amenities?: string[];
    roomImages?: string[];
    cancellationDeadline?: string;
    cancelPolicy?: {
        refundable?: boolean;
        cancelPenalties?: Array<{ deadline?: string; amount?: number; currency?: string }>;
    };
    rates?: RateRow[];
}

export interface HotelContent {
    hotel_id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    star_rating: number | null;
    description: string | null;
    images: string[];
    amenities: string[] | string | null;
    lat: number | null;
    lng: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
}

export interface PropertyReview {
    rating: number | string | null;
    reviews_count: number;
}

export interface ReviewItem {
    reviewer_name: string | null;
    score: number | string | null;
    pros: string | null;
    cons: string | null;
    headline: string | null;
    country: string | null;
}

export interface PropertyApiResponse {
    content?: HotelContent;
    reviews?: PropertyReview | null;
    reviewItems?: ReviewItem[];
    rooms?: RoomOption[];
    error?: string;
}

export interface PropertySearchParams {
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
    destination?: string;
    currency?: string;
}

// Design tokens — kept alongside types so all hotel components share one source of truth
export const HOTEL_TOKENS = {
    ACCENT: '#FF6B4B',
    GREEN:  '#2FB67F',
    TEXT:   '#F5EFE4',
    BG:     'linear-gradient(180deg,#15111E,#1B1526)',
} as const;

export function ratingInfo(score: number): { label: string; color: string } {
    if (score >= 9) return { label: 'Exceptional', color: HOTEL_TOKENS.GREEN };
    if (score >= 8) return { label: 'Excellent',   color: '#4FA8E0' };
    return                  { label: 'Good',        color: '#E0A23C' };
}
