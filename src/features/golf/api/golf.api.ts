import { http } from '@/shared/lib/http';
import type {
    AdminGolfBooking, AdminGolfBookingPage, AdminGolfPage, GolfBooking, GolfBookingList, GolfCatalogue, GolfCourse,
    GolfCourseDraft, GolfCourseStatus, GolfExtraChoice, GolfExtraOffer, ScheduleDraft, StartedGolfBooking, TeeTimeDay,
    TeeTimeQuote, TeeTimeSchedule,
} from '@/features/golf/types';

interface Envelope<T> {
    success: boolean;
    data:    T;
}

const query = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    const s = qs.toString();
    return s ? `?${s}` : '';
};

/** The storefront's list: published courses, and the countries it can be narrowed to. */
export async function fetchGolfCatalogue(opts: { country?: string; currency?: string } = {}): Promise<GolfCatalogue> {
    return (await http.get<Envelope<GolfCatalogue>>(`/golf/courses${query(opts)}`)).data;
}

/** One published course. Rejects with `status: 404` for a slug a customer may not see. */
export async function fetchGolfCourse(slug: string, currency?: string): Promise<GolfCourse> {
    return (await http.get<Envelope<GolfCourse>>(`/golf/courses/${encodeURIComponent(slug)}${query({ currency })}`)).data;
}

/**
 * One course-local day of tee times, priced for `players` in `currency`. With no `date`, api-v2
 * answers the first day that has a tee time; a date outside the range is answered for its nearer end.
 */
export async function fetchTeeTimes(slug: string, opts: { date?: string; players: number; currency?: string }): Promise<TeeTimeDay> {
    const path = `/golf/courses/${encodeURIComponent(slug)}/tee-times`;
    return (await http.get<Envelope<TeeTimeDay>>(`${path}${query({ date: opts.date, players: String(opts.players), currency: opts.currency })}`)).data;
}

/**
 * What a tee time costs this party, with `extras` as `formatExtrasParam` writes them. Rejects with
 * `status: 409` and a `code` when it can no longer be booked, and `status: 404` for one that is not there.
 */
export async function fetchTeeTimeQuote(teeTimeId: string, opts: { players: number; currency?: string; extras?: string }): Promise<TeeTimeQuote> {
    const path = `/golf/tee-times/${encodeURIComponent(teeTimeId)}/quote`;
    return (await http.get<Envelope<TeeTimeQuote>>(`${path}${query({ players: String(opts.players), currency: opts.currency, extras: opts.extras })}`)).data;
}

/**
 * Take the spots and open the payment. `shownTotal` is what the customer was shown: they are never
 * asked for more than that, and a rate that moved comes back as `code: 'PRICE_CHANGED'` with the new figures.
 * Extras the course no longer offers come back as `code: 'EXTRAS_UNAVAILABLE'`.
 */
export async function startGolfBooking(body: {
    teeTimeId: string; players: number; leadName: string; currency?: string; shownTotal: number; extras: GolfExtraChoice[];
}): Promise<StartedGolfBooking> {
    return (await http.post<Envelope<StartedGolfBooking>>('/golf/bookings', body)).data;
}

/** The customer's own booking, brought up to date with the payment. Rejects with `status: 404` for anyone else's. */
export async function fetchGolfBooking(reference: string): Promise<GolfBooking> {
    return (await http.get<Envelope<GolfBooking>>(`/golf/bookings/${encodeURIComponent(reference)}`)).data;
}

/** The customer's own bookings, for My Bookings. */
export async function fetchMyGolfBookings(): Promise<GolfBooking[]> {
    return (await http.get<Envelope<GolfBooking[]>>('/golf/bookings')).data ?? [];
}

/**
 * The customer cancels their own booking: a request releases the card, a confirmed booking is refunded
 * in full while free cancellation lasts. Rejects with a `code` when it cannot be done.
 */
export async function cancelGolfBooking(reference: string): Promise<GolfBooking> {
    return (await http.post<Envelope<GolfBooking>>(`/golf/bookings/${encodeURIComponent(reference)}/cancel`)).data;
}

/** The back office's side: api-v2 `/admin/golf`, admins only. */
export const adminGolfApi = {
    list: (page: number, q?: string) =>
        http.get<AdminGolfPage>(`/admin/golf/courses${query({ page: String(page), q })}`),
    create: async (draft: GolfCourseDraft) =>
        (await http.post<Envelope<GolfCourse>>('/admin/golf/courses', draft)).data,
    update: async (id: string, draft: GolfCourseDraft) =>
        (await http.put<Envelope<GolfCourse>>(`/admin/golf/courses/${id}`, draft)).data,
    setStatus: async (id: string, status: GolfCourseStatus) =>
        (await http.patch<Envelope<GolfCourse>>(`/admin/golf/courses/${id}/status`, { status })).data,
    remove: (id: string) => http.delete<{ success: boolean }>(`/admin/golf/courses/${id}`),
    listSchedules: async (courseId: string) =>
        (await http.get<Envelope<TeeTimeSchedule[]>>(`/admin/golf/courses/${courseId}/schedules`)).data,
    addSchedule: async (courseId: string, draft: ScheduleDraft) =>
        (await http.post<Envelope<{ schedule: TeeTimeSchedule; created: number }>>(`/admin/golf/courses/${courseId}/schedules`, draft)).data,
    removeSchedule: (courseId: string, scheduleId: string) =>
        http.delete<{ success: boolean }>(`/admin/golf/courses/${courseId}/schedules/${scheduleId}`),
    listExtras: async (courseId: string) =>
        (await http.get<Envelope<GolfExtraOffer[]>>(`/admin/golf/courses/${courseId}/extras`)).data,
    setExtras: async (courseId: string, extras: GolfExtraOffer[]) =>
        (await http.put<Envelope<GolfExtraOffer[]>>(`/admin/golf/courses/${courseId}/extras`, { extras })).data,
    listBookings: (view: GolfBookingList, page: number) =>
        http.get<AdminGolfBookingPage>(`/admin/golf/bookings${query({ view, page: String(page) })}`),
    confirmBooking: async (reference: string) =>
        (await http.post<Envelope<AdminGolfBooking>>(`/admin/golf/bookings/${encodeURIComponent(reference)}/confirm`)).data,
    declineBooking: async (reference: string) =>
        (await http.post<Envelope<AdminGolfBooking>>(`/admin/golf/bookings/${encodeURIComponent(reference)}/decline`)).data,
    cancelBooking: async (reference: string) =>
        (await http.post<Envelope<AdminGolfBooking>>(`/admin/golf/bookings/${encodeURIComponent(reference)}/cancel`)).data,
};
