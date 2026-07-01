"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export const AuthListener = () => {
    const { initSession, fetchAndSyncRole } = useAuthStore();

    useEffect(() => {
        const init = async () => {
            await initSession();
            await fetchAndSyncRole();
        };
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
};
