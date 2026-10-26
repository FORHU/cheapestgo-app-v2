'use client';

import { useEffect } from 'react';

/**
 * Swaps the app shell's background for the flat ground v2's results
 * pages use (`body.flat-ground` in globals.css). A
 * server component page cannot toggle the body class itself, so this is
 * the mountable marker that does it on its behalf.
 */
export function FlatGround() {
    useEffect(() => {
        document.body.classList.add('flat-ground');
        return () => document.body.classList.remove('flat-ground');
    }, []);

    return null;
}
