'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { queryClient } from '@/shared/lib/query-client';
import { useAuthStore } from '@/shared/auth/store';

function AuthInitializer() {
    const fetchUser = useAuthStore((s) => s.fetchUser);
    useEffect(() => { fetchUser(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <AuthInitializer />
                {children}
                <Toaster richColors position="top-right" />
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
