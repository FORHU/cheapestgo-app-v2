import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
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
