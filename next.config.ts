import type { NextConfig } from 'next';

const config: NextConfig = {
    images: {
        formats: ['image/avif', 'image/webp'],
        localPatterns: [
            { pathname: '/images/**' },
        ],
        remotePatterns: [
            { protocol: 'https', hostname: '**.hotelbeds.com' },
            { protocol: 'https', hostname: '**.travelgatex.com' },
            { protocol: 'https', hostname: '**.ratehawk.com' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
        ],
    },
};

export default config;
