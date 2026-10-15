'use client';

/**
 * Where a booking is, at an address that survives a refresh.
 *
 * The checkout's own "confirmed" screen lives in React state, so a refresh, a back-button or a
 * link from a confirmation email lost it — and, worse, sent the traveller back through a
 * checkout whose payment had already been taken. This is the page those land on instead: it
 * asks the server, keeps asking while the answer is "not yet", and never invents a reference.
 *
 * The reference comes from the URL and from nowhere else. An earlier version of the confirmed
 * screen minted a random one when it had none, which is a receipt for a booking that does not
 * exist.
 */

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { useTheme } from '@/shared/components/ThemeContext';
import { useBookingStatus } from '../hooks/use-booking-status';
import { checkoutPalette, GREEN, type Palette } from '../lib/palette';
import { BookingFailedPanel, SettlingPanel } from './booking-state-panels';

function Shell({ palette, children }: { palette: Palette; children: React.ReactNode }) {
    return (
        <main style={{ minHeight: '100vh', background: palette.bg, color: palette.text, padding: 'clamp(24px,5vw,64px) 16px' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>{children}</div>
        </main>
    );
}

function Quiet({ palette, children }: { palette: Palette; children: React.ReactNode }) {
    return <p style={{ color: palette.soft, fontSize: 15, lineHeight: 1.5 }}>{children}</p>;
}

function StatusBody({ reference, palette }: { reference: string; palette: Palette }) {
    const t = useTranslations('checkout');
    const tSuccess = useTranslations('checkout.success');
    const router = useRouter();
    const { load, outcome, exhausted, refresh } = useBookingStatus(reference);

    if (load === 'loading') {
        return <Quiet palette={palette}>{t('bookingPage.loading')}</Quiet>;
    }

    if (load === 'not_found') {
        return (
            <>
                <h1 style={{ color: palette.title, fontSize: 22 }}>{t('bookingPage.notFound')}</h1>
                <Quiet palette={palette}>{t('bookingPage.notFoundDescription')}</Quiet>
            </>
        );
    }

    if (load === 'error' || !outcome) {
        return (
            <>
                <Quiet palette={palette}>{t('supplierDown.description')}</Quiet>
                <button type="button" onClick={() => void refresh()} style={buttonStyle(palette)}>
                    {t('bookingPage.refresh')}
                </button>
            </>
        );
    }

    if (outcome.kind === 'confirmed') {
        return (
            <section role="status" style={{ textAlign: 'center' }}>
                <div style={{
                    width: 72, height: 72, borderRadius: '50%', background: GREEN, margin: '0 auto 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Check size={36} color="#fff" strokeWidth={3} aria-hidden />
                </div>
                <h1 style={{ color: palette.title, fontSize: 24, margin: 0 }}>{t('booked')}</h1>
                <Quiet palette={palette}>{tSuccess('hotelSuccess')}</Quiet>
                <p style={{ color: palette.soft, fontSize: 14 }}>
                    {t('bookingReference')}:{' '}
                    <strong style={{ color: palette.title, userSelect: 'all' }}>{outcome.reference}</strong>
                </p>
                <Link href="/trips" style={{ ...buttonStyle(palette), display: 'inline-block', textDecoration: 'none' }}>
                    {tSuccess('viewMyTrips')}
                </Link>
            </section>
        );
    }

    if (outcome.kind === 'failed') {
        return (
            <BookingFailedPanel
                released={outcome.released}
                message={outcome.message}
                palette={palette}
                onTryAgain={() => router.push('/')}
            />
        );
    }

    return (
        <>
            <SettlingPanel
                phase={outcome.kind}
                reference={outcome.reference ?? reference}
                palette={palette}
                onViewTrips={() => router.push('/trips')}
            />
            {exhausted ? (
                <button type="button" onClick={() => void refresh()} style={buttonStyle(palette)}>
                    {t('bookingPage.refresh')}
                </button>
            ) : (
                <Quiet palette={palette}>{t('bookingPage.stillWorking')}</Quiet>
            )}
        </>
    );
}

function buttonStyle(palette: Palette): React.CSSProperties {
    return {
        padding: '12px 22px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 14,
        fontFamily: 'inherit', cursor: 'pointer', background: palette.title, color: palette.bg, marginTop: 16,
    };
}

export function BookingStatusView() {
    const t = useTranslations('checkout');
    const params = useParams<{ reference: string }>();
    const reference = decodeURIComponent(params?.reference ?? '');

    const { user, isLoading } = useAuthStore();
    const { theme } = useTheme();
    const palette = checkoutPalette(theme);

    // Not asked until we know who is asking: the endpoint is the traveller's own, and a 404 for
    // "you are not signed in yet" would read as "this booking does not exist".
    if (isLoading) {
        return <Shell palette={palette}><Quiet palette={palette}>{t('bookingPage.loading')}</Quiet></Shell>;
    }

    if (!user) {
        const redirect = encodeURIComponent(typeof window === 'undefined' ? '/trips' : window.location.pathname);
        return (
            <Shell palette={palette}>
                <h1 style={{ color: palette.title, fontSize: 22 }}>{t('signInToComplete')}</h1>
                <Link href={`/login?redirect=${redirect}`} style={{ ...buttonStyle(palette), display: 'inline-block', textDecoration: 'none' }}>
                    {t('signIn')}
                </Link>
            </Shell>
        );
    }

    return <Shell palette={palette}><StatusBody reference={reference} palette={palette} /></Shell>;
}
