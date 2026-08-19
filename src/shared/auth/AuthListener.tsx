"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';

export const AuthListener = () => {
    const { initSession } = useAuthStore();

    useEffect(() => {
        initSession();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
};
