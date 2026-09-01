import '@testing-library/jest-dom';

// The app reads its backend address from the environment and validates it at
// import time (shared/lib/env). Tests get the same shape as local development so
// that anything importing `env` — or building a URL from NEXT_PUBLIC_API_URL —
// resolves to a real address rather than the string "undefined".
process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:4000/api/v2';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3002';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??= 'pk_test_stub';

// jsdom ships no ResizeObserver; the hotel components use it to re-measure chip
// rows and the description clamp on resize. A no-op stub is enough for tests —
// they assert on rendered content, not on layout that only a real browser has.
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
}
