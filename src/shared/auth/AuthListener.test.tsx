/**
 * A fresh page load (a refresh, a pasted link, the return from Google) is the only time the
 * browser learns who is signed in. app-v2 has two auth stores and pages read both — hotel
 * checkout reads `./store` — so the load has to fill both, or that page thinks the person
 * is signed out while the API still knows them.
 */

import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/http', () => ({ http: { get } }));

import { AuthListener } from './AuthListener';
import { useAuthStore } from './store';
import { useAuthStore as useSessionStore } from '@/shared/stores/auth.store';

const apiUser = {
    id: 'u1', email: 'billy@example.com', role: 'user',
    first_name: 'Billy', last_name: 'Busilan', avatar_url: null,
};

describe('AuthListener', () => {
    beforeEach(() => {
        useAuthStore.setState({ user: null, isLoading: true });
        useSessionStore.setState({ user: null, isLoading: true });
    });

    it('restores the session into both auth stores', async () => {
        get.mockResolvedValue({ user: apiUser });

        render(<AuthListener />);

        await waitFor(() => {
            expect(useAuthStore.getState()).toMatchObject({ user: { id: 'u1', first_name: 'Billy' }, isLoading: false });
            expect(useSessionStore.getState()).toMatchObject({ user: { id: 'u1', firstName: 'Billy' }, isLoading: false });
        });
    });

    it('settles both as signed out when there is no session', async () => {
        get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));

        render(<AuthListener />);

        await waitFor(() => {
            expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: false });
            expect(useSessionStore.getState()).toMatchObject({ user: null, isLoading: false });
        });
    });
});
