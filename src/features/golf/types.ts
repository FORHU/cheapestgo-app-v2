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
}

export interface AdminGolfPage {
    data:       GolfCourse[];
    total:      number;
    page:       number;
    pageSize:   number;
    totalPages: number;
}
