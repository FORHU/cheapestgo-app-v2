'use client';

import React from 'react';
import { Link } from '@/i18n/navigation';
import { Wrench, PlaneTakeoff, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/shared/components/ThemeContext';
import { BRAND, brandTheme } from '@/shared/lib/palette';

/**
 * Shown where a stay would normally be searched or booked, while hotel supply is off.
 *
 * Not a warning stripe. Nothing the visitor did has failed and flights still sell, so this
 * reads as a considered empty state on the brand's own ground — one amber mark against
 * obsidian/alabaster — rather than an alert bar. The route out to flights is the point of
 * the panel: a dead end offering nowhere to go reads as a broken site.
 *
 * `compact` is the in-page form used above a property's rooms, where the page has its own
 * heading and a full-height centred block would push the room list off screen.
 */
function noticePalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    const brand = brandTheme(theme);
    return {
        title:      brand.title,
        muted:      brand.muted,
        surface:    brand.surface,
        hairline:   brand.hairline,
        // amber-400 / amber-600 — the one warm mark, legible on either ground.
        mark:       dark ? '#fbbf24' : '#d97706',
        markBg:     dark ? 'rgba(251,191,36,.12)' : 'rgba(217,119,6,.10)',
        markBorder: dark ? 'rgba(251,191,36,.28)' : 'rgba(217,119,6,.22)',
        // emerald-400 / emerald-600 — flights are up.
        live:       dark ? '#34d399' : '#059669',
    };
}

export function StaysMaintenanceNotice({ compact = false }: { compact?: boolean }) {
    const t = useTranslations('hotels.maintenance');
    const { theme } = useTheme();
    const c = noticePalette(theme);

    const mark = (size: number, box: number) => (
        <span
            style={{
                width: box, height: box, borderRadius: box * 0.3,
                background: c.markBg, border: `1px solid ${c.markBorder}`, color: c.mark,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
        >
            <Wrench size={size} />
        </span>
    );

    const flightsCta = (
        <Link
            href="/flights/search"
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                color: '#fff', background: BRAND.gradient, boxShadow: BRAND.gradientShadow,
                whiteSpace: 'nowrap',
            }}
        >
            <PlaneTakeoff size={16} />
            {t('flightsCta')}
            <ArrowRight size={14} />
        </Link>
    );

    if (compact) {
        return (
            <div
                role="status"
                style={{
                    display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
                    padding: 20, borderRadius: 16,
                    background: c.surface, border: `1px solid ${c.hairline}`,
                }}
            >
                {mark(18, 44)}
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.title, letterSpacing: '-0.01em' }}>
                        {t('title')}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.6, color: c.muted }}>
                        {t('description')}
                    </p>
                </div>
                {flightsCta}
            </div>
        );
    }

    return (
        <div
            role="status"
            style={{
                minHeight: '62vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                padding: '64px 16px', margin: '0 auto', maxWidth: 560,
            }}
        >
            {mark(26, 64)}

            <h1 style={{ margin: '28px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: c.title }}>
                {t('title')}
            </h1>

            <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.7, color: c.muted }}>
                {t('description')}
            </p>

            <span
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24,
                    padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                    color: c.muted, background: c.surface, border: `1px solid ${c.hairline}`,
                }}
            >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: c.live }} aria-hidden />
                {t('note')}
            </span>

            <div style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
                {flightsCta}
                <Link
                    href="/"
                    style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                        color: c.title, background: c.surface, border: `1px solid ${c.hairline}`,
                    }}
                >
                    {t('homeCta')}
                </Link>
            </div>
        </div>
    );
}

export default StaysMaintenanceNotice;
