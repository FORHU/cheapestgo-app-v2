import { describe, it, expect, vi, beforeEach } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/shared/lib/http', () => ({ http }));

import { adminGolfApi, fetchGolfCatalogue, fetchGolfCourse } from '@/features/golf/api/golf.api';

beforeEach(() => vi.clearAllMocks());

describe('golf api', () => {
    it('asks for the list with only the filters it was given, and unwraps it', async () => {
        http.get.mockResolvedValue({ success: true, data: { courses: [], countries: [] } });
        expect(await fetchGolfCatalogue({ currency: 'KRW' })).toEqual({ courses: [], countries: [] });
        expect(http.get).toHaveBeenCalledWith('/golf/courses?currency=KRW');
        await fetchGolfCatalogue();
        expect(http.get).toHaveBeenLastCalledWith('/golf/courses');
    });

    it('escapes the slug and passes the currency', async () => {
        http.get.mockResolvedValue({ success: true, data: { slug: 'a b' } });
        await fetchGolfCourse('a b', 'PHP');
        expect(http.get).toHaveBeenCalledWith('/golf/courses/a%20b?currency=PHP');
    });

    it('pages the admin list and sends a search only when there is one', async () => {
        http.get.mockResolvedValue({ data: [], total: 0, page: 2, pageSize: 20, totalPages: 1 });
        await adminGolfApi.list(2);
        expect(http.get).toHaveBeenCalledWith('/admin/golf/courses?page=2');
        await adminGolfApi.list(1, 'wack');
        expect(http.get).toHaveBeenLastCalledWith('/admin/golf/courses?page=1&q=wack');
    });
});

describe('tee times api', () => {
    it("asks for a day's tee times with only what it was given", async () => {
        const { fetchTeeTimes } = await import('@/features/golf/api/golf.api');
        http.get.mockResolvedValue({ success: true, data: { date: '2026-11-15', teeTimes: [] } });
        expect(await fetchTeeTimes('wack-wack', { players: 2, currency: 'KRW' })).toEqual({ date: '2026-11-15', teeTimes: [] });
        expect(http.get).toHaveBeenCalledWith('/golf/courses/wack-wack/tee-times?players=2&currency=KRW');
        await fetchTeeTimes('wack-wack', { date: '2026-11-15', players: 3 });
        expect(http.get).toHaveBeenLastCalledWith('/golf/courses/wack-wack/tee-times?date=2026-11-15&players=3');
    });

    it("lists, adds and removes a course's schedules for an admin", async () => {
        const { adminGolfApi } = await import('@/features/golf/api/golf.api');
        http.get.mockResolvedValue({ success: true, data: [] });
        http.post.mockResolvedValue({ success: true, data: { schedule: { id: 's1' }, created: 42 } });
        http.delete.mockResolvedValue({ success: true });
        expect(await adminGolfApi.listSchedules('c1')).toEqual([]);
        expect(http.get).toHaveBeenLastCalledWith('/admin/golf/courses/c1/schedules');
        expect(await adminGolfApi.addSchedule('c1', { name: 'x' } as never)).toEqual({ schedule: { id: 's1' }, created: 42 });
        expect(http.post).toHaveBeenLastCalledWith('/admin/golf/courses/c1/schedules', { name: 'x' });
        await adminGolfApi.removeSchedule('c1', 's1');
        expect(http.delete).toHaveBeenLastCalledWith('/admin/golf/courses/c1/schedules/s1');
    });
});
