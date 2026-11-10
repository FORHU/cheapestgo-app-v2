'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        // Every browser has it; a test's simulated DOM (jsdom) does not. There the query simply
        // does not match, rather than the component that asked failing to mount.
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(query);
        setMatches(mq.matches);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 768px)');
}
