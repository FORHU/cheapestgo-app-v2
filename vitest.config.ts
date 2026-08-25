import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/setup.ts'],
        /**
         * `shared/lib/env.ts` parses the NEXT_PUBLIC_* vars at module load and
         * throws when any is missing — so anything that reaches it cannot even
         * be *imported* without them. `shared/lib/http` does, and through it
         * `shared/lib/currency`, which is how a component that only wanted to
         * convert a price ends up needing a Stripe key.
         *
         * Stubs rather than the real `.env`: that file is gitignored, so CI has
         * none, and a test that reads whatever happens to be on the machine is
         * a test that passes for the wrong reason. Nothing here is dialled —
         * the values only have to satisfy the schema.
         */
        env: {
            NEXT_PUBLIC_API_URL:                'http://localhost:4000/api/v2',
            NEXT_PUBLIC_SITE_URL:               'http://localhost:3000',
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_stub',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
