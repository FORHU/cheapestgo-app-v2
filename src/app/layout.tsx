import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/shared/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: {
        default:  'CheapestGo',
        template: '%s | CheapestGo',
    },
    description: 'Find and book the cheapest flights and hotels worldwide.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
