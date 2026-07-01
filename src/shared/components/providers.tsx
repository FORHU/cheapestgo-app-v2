'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/shared/lib/query-client';
import { ThemeProvider } from '@/shared/components/ThemeContext';
import { PWAInstallProvider } from '@/contexts/PWAInstallContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <PWAInstallProvider>
                    {children}
                </PWAInstallProvider>
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
