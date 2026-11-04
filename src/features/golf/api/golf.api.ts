import { http } from '@/shared/lib/http';
import type {
    AdminGolfPage, GolfCatalogue, GolfCourse, GolfCourseDraft, GolfCourseStatus, ScheduleDraft, TeeTimeDay, TeeTimeSchedule,
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
};
