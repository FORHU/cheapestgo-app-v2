// src/features/golf-api-demo/api/golfMockApi.client.ts
import { mockHttp } from './mockHttp';
import type {
    GolfServiceCategory, MockAvailability, MockBooking, MockCancelResult, MockCourse, MockHold,
    MockScenario, MockService, MockServiceBooking,
} from '../types';

const query = (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') qs.set(key, String(value));
    const s = qs.toString();
    return s ? `?${s}` : '';
};

export const golfMockApi = {
    listCourses: (opts: { query?: string; country?: string } = {}) =>
        mockHttp.get<{ courses: MockCourse[]; total: number; countries: string[] }>(`/courses${query(opts)}`),

    getCourse: (idOrSlug: string) =>
        mockHttp.get<MockCourse>(`/courses/${encodeURIComponent(idOrSlug)}`),

    getTeeTimes: (idOrSlug: string, opts: { date?: string; players: number }) =>
        mockHttp.get<MockAvailability>(`/courses/${encodeURIComponent(idOrSlug)}/tee-times${query(opts)}`),

    hold: (body: { courseId: string; teeTimeId: string; players: number; leadName: string; contactEmail: string }) =>
        mockHttp.post<MockHold>('/holds', body),

    book: (body: {
        holdId: string; courseId: string; teeTimeId: string; players: number;
        leadName: string; contactEmail: string; currency: string; total: number;
    }) => mockHttp.post<MockBooking>('/bookings', body),

    getBooking: (reference: string) =>
        mockHttp.get<MockBooking>(`/bookings/${encodeURIComponent(reference)}`),

    cancelBooking: (reference: string) =>
        mockHttp.post<MockCancelResult>(`/bookings/${encodeURIComponent(reference)}/cancel`),

    getScenario: () => mockHttp.get<{ scenario: MockScenario | null }>('/scenario'),
    setScenario: (scenario: MockScenario | null) => mockHttp.put<{ scenario: MockScenario | null }>('/scenario', { scenario }),

    listServices: (opts: { category?: GolfServiceCategory; currency?: string } = {}) =>
        mockHttp.get<{ services: MockService[]; total: number; requestedCurrency?: string; rateUnavailable?: boolean }>(`/services${query(opts)}`),

    bookService: (serviceId: string, body: {
        leadName: string; contactEmail: string; courseId?: string;
        quantity?: number; preferredDate?: string; partySize?: number; adults?: number; juniors?: number;
        notes?: string; currency?: string;
    }) => mockHttp.post<MockServiceBooking>(`/services/${encodeURIComponent(serviceId)}/book`, body),

    getServiceBooking: (reference: string) =>
        mockHttp.get<MockServiceBooking>(`/services/bookings/${encodeURIComponent(reference)}`),

    cancelServiceBooking: (reference: string) =>
        mockHttp.post<MockServiceBooking>(`/services/bookings/${encodeURIComponent(reference)}/cancel`),
};
