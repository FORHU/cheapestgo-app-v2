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

// ─── Room-detail modal (mirrors cheapestgo-api-v2 src/lib/hotels/roomContent.types.ts) ──

export type SectionId =
    | 'room-layout' | 'toiletries' | 'food-drink' | 'bathroom' | 'internet-comms'
    | 'room-amenities' | 'media-tech' | 'kitchen' | 'general' | 'child-policy' | 'beds-extra';

/**
 * Icon vocabulary shared with the API. Every member must have an entry in the
 * `SECTION_ICONS` map in `room-content.tsx` — `Record<IconId, LucideIcon>` makes a
 * gap a compile error. Keep in sync with the API's `IconId`.
 */
export type IconId =
    | 'bath' | 'shower' | 'toiletries' | 'fridge' | 'coffee' | 'kitchen' | 'wifi'
    | 'phone' | 'tv' | 'wardrobe' | 'desk' | 'window' | 'safe' | 'ac' | 'heating'
    | 'smoking' | 'bed' | 'view' | 'child' | 'check';

export interface DetailItem { label: string; icon?: IconId; note?: string }

export interface DetailSection {
    id: SectionId;
    title: string;
    scope: 'room' | 'property';
    items: DetailItem[];
}

export interface AmenityGroup { groupName: string; amenities: string[]; nonFree: string[] }

export interface RoomContent {
    gallery: string[];
    matchedRoomName?: string;
    keyFacts: DetailItem[];
    bedLine?: string;
    bedsExtraSummary?: string;
    sections: DetailSection[];
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
    /** ETG room-detail content — attached by the API when a room-group matches. */
    content?: RoomContent;
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
    /** ETG-sourced extras — grouped hotel amenities + property policy sections + free-text tail. */
    amenityGroups?: AmenityGroup[];
    roomPolicySections?: DetailSection[];
    additionalInfo?: string;
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
