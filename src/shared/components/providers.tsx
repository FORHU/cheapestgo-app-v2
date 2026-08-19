'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/shared/lib/query-client';
import { ThemeProvider } from '@/shared/components/ThemeContext';
import { ChromeToneProvider } from '@/shared/components/ChromeToneContext';
import { PWAInstallProvider } from '@/contexts/PWAInstallContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                {/* Inside ThemeProvider: the tone falls back to the theme. */}
                <ChromeToneProvider>
                    <PWAInstallProvider>
                        {children}
                    </PWAInstallProvider>
                </ChromeToneProvider>
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
