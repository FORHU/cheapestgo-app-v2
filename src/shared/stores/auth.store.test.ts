import { describe, it, expect, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/http', () => ({ http: { get } }));

import { useAuthStore } from './auth.store';

describe('initSession', () => {
    it('keeps the name api-v2 sends, which arrives snake_case', async () => {
        get.mockResolvedValue({
            user: {
                id: 'u1', email: 'billy@example.com', role: 'user',
                first_name: 'Billy', last_name: 'Busilan', avatar_url: 'https://example.com/b.png',
            },
        });

        await useAuthStore.getState().initSession();

        expect(useAuthStore.getState().user).toEqual({
            id: 'u1', email: 'billy@example.com', role: 'user',
            firstName: 'Billy', lastName: 'Busilan', avatar: 'https://example.com/b.png',
        });
    });
});
