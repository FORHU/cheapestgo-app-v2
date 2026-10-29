import { NextIntlClientProvider } from 'next-intl';
// Named imports rather than the whole file: webpack gives JSON named exports and drops the
// rest, so the staff bundle carries ~1.4 KB of en.json instead of all 102 KB.
import { common, support } from '@/locales/en.json';

/**
 * English for the staff routes.
 *
 * `/admin` sits outside the `[locale]` segment, so none of it is wrapped in the provider the
 * storefront gets — and any client component calling `useTranslations` throws. A production
 * build strips the message, so the route hit its error boundary showing a bare `Error` with
 * no text at all: that is what took out the Support desk on opening a chat, and anything
 * rendering `Dialog` (Customers).
 *
 * Fixed here rather than in each component because the offenders are *shared* ones — Dialog
 * is also used under `[locale]`, where removing translation would be a regression. One
 * provider at the top of the staff tree covers every page under it, including the next
 * shared component someone reuses here.
 *
 * Staff screens are English-only (see src/i18n/navigation.ts), so this supplies English
 * outright rather than negotiating a locale. Only the namespaces staff screens actually read
 * are passed — a page reaching for a third one gets the same silent throw, so add it here.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <NextIntlClientProvider locale="en" messages={{ common, support }}>
            {children}
        </NextIntlClientProvider>
    );
}
