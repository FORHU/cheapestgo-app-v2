"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useAuthStore as useLegacyAuthStore } from '@/shared/auth/store';

/**
 * Asks who is signed in, once per page load.
 *
 * app-v2 carries two auth stores and pages read both: the headers this one, hotel checkout
 * and admin the other. Both are filled here, or a refresh mid-booking leaves checkout
 * thinking the person is signed out while the API still knows them. Two `/auth/me` calls
 * until the stores are consolidated.
 */
export const AuthListener = () => {
    const { initSession } = useAuthStore();
    const fetchUser = useLegacyAuthStore((s) => s.fetchUser);

    useEffect(() => {
        initSession();
        fetchUser();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
};
