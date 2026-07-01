import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import { Providers } from '@/shared/components/providers';
import './globals.css';

const inter      = Inter({ subsets: ['latin'], variable: '--font-sans' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-display' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cheapestgo.com';

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default:  'CheapestGo | Discover and Book Your Next Global Journey',
        template: '%s | CheapestGo',
    },
    description: 'Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with CheapestGo — your modern travel OS.',
    icons: {
        icon:  '/Fav_Icon_Light.png',
        apple: '/Fav_Icon_Light.png',
    },
    appleWebApp: {
        capable:         true,
        statusBarStyle:  'black-translucent',
        title:           'CheapestGo',
    },
    openGraph: {
        title:       'CheapestGo | Discover and Book Your Next Global Journey',
        description: 'Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with CheapestGo — your modern travel OS.',
        url:         SITE_URL,
        siteName:    'CheapestGo',
        images: [{
            url:    `${SITE_URL}/og-image.png`,
            width:  1200,
            height: 630,
            alt:    'CheapestGo — Ultimate Travel Booking Platform',
        }],
        locale: 'en_US',
        type:   'website',
    },
    twitter: {
        card:        'summary_large_image',
        title:       'CheapestGo | Discover and Book Your Next Global Journey',
        description: 'Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with CheapestGo — your modern travel OS.',
        images:      [`${SITE_URL}/og-image.png`],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${interTight.variable} font-sans`}>
                <Providers>
                    <div className="relative min-h-screen w-full bg-alabaster dark:bg-obsidian text-slate-900 dark:text-white bg-grid-alabaster dark:bg-grid-obsidian">
                        <div className="relative flex flex-col min-h-screen">
                            {children}
                        </div>
                    </div>
                </Providers>
            </body>
        </html>
    );
}
