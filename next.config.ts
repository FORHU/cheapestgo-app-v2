import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
    /**
     * Where the build output goes, overridable per run.
     *
     * NEXT_PUBLIC_* values are compiled into the client bundle while the server reads them at
     * runtime, so a dev server started under a different brand leaves client chunks naming that
     * brand in the shared .next directory. The next ordinary run then serves them beside a
     * server render from .env, and React reports a hydration mismatch that looks like a bug in
     * the header. Giving a brand-switched run its own directory keeps the default cache clean:
     *
     *   NEXT_DIST_DIR=.next-airanggo NEXT_PUBLIC_BRAND_NAME=GeomeeGo npx next dev --port 3210
     */
    distDir: process.env.NEXT_DIST_DIR || '.next',
    async rewrites() {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v2').replace(/\/$/, '');
        return [
            {
                source:      '/api/v2/photos/:path*',
                destination: `${apiBase}/photos/:path*`,
            },
        ];
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 64, 96, 128, 256, 320],
        localPatterns: [
            { pathname: '/images/**' },
            { pathname: '/*.png' },
            { pathname: '/*.svg' },
            { pathname: '/*.jpg' },
        ],
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
};

export default withNextIntl(config);
