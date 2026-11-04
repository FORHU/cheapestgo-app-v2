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
