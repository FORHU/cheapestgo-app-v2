"use client";

import { useEffect } from 'react';
import { refreshExchangeRates } from '@/shared/lib/currency';

export const ExchangeRateListener = () => {
    useEffect(() => {
        refreshExchangeRates();
    }, []);
    return null;
};
