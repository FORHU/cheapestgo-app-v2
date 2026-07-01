import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: [
        './src/app/**/*.{ts,tsx}',
        './src/features/**/*.{ts,tsx}',
        './src/shared/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                alabaster: '#f8fafc',
                obsidian:  '#020617',
            },
            fontFamily: {
                sans:    ['var(--font-sans)', 'Inter', 'sans-serif'],
                display: ['var(--font-display)', 'Inter Tight', 'sans-serif'],
                mono:    ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
            },
            transitionDuration: {
                '800': '800ms',
            },
        },
    },
    plugins: [],
};

export default config;
