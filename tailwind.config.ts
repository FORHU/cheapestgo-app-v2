import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: [
        './src/app/**/*.{ts,tsx}',
        './src/features/**/*.{ts,tsx}',
        './src/shared/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};

export default config;
