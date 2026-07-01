import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 64, 96, 128, 256, 320],
        localPatterns: [
            { pathname: '/images/**' },
        ],
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
};

export default withNextIntl(config);
