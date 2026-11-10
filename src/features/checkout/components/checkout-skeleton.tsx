'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/shared/components/ThemeContext';
import { checkoutPalette } from '@/features/checkout/lib/palette';
import { SkeletonBar } from './skeleton-bar';

/**
 * The checkout, drawn as skeleton while it is on its way: the toolbar, the steps, the heading,
 * the trip summary and a few rows of fields, on the checkout's own ground and grid.
 *
 * Shown by the checkout route while it loads (`checkout/loading.tsx`), by the `/flights/book`
 * hand-over, and by the page's own wait for its search parameters. All three used to show
 * nothing, and with nothing above it the layout's footer was what a phone showed — a screen of
 * links where the checkout should be. A screen tall, so the footer stays below the fold.
 */
export function CheckoutSkeleton() {
    const t = useTranslations('checkout');
    const { theme } = useTheme();
    const palette = checkoutPalette(theme);
    const disc = { width: 44, height: 44, borderRadius: '50%', background: palette.surface } as const;
    const field = (key: string) => (
        <div key={key} style={{ display: 'grid', gap: 8 }}>
            <SkeletonBar palette={palette} width={84} height={12} />
            <SkeletonBar palette={palette} height={48} />
        </div>
    );

    return (
        <div
            data-checkout-skeleton
            role="status"
            aria-label={t('loadingCheckout')}
            aria-busy="true"
            className="min-h-screen"
            style={{ background: palette.bg }}
        >
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 72px' }}>
                {/* Toolbar: back on the left, currency and theme on the right. */}
                <div aria-hidden style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
                    <span style={disc} />
                    <span style={{ display: 'flex', gap: 12 }}><span style={disc} /><span style={disc} /></span>
                </div>

                <div aria-hidden className="grid grid-cols-1 lg:grid-cols-[minmax(0,645px)_minmax(300px,370px)] lg:justify-between gap-x-[clamp(40px,8vw,130px)]">
                    <div className="lg:col-start-1 lg:row-start-1" style={{ display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                            {[0, 1, 2].map(i => <span key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: palette.surface }} />)}
                        </div>
                        <SkeletonBar palette={palette} width="78%" height={36} />
                        <SkeletonBar palette={palette} width="40%" height={22} />
                    </div>

                    {/* The trip summary: a bar above the form on a phone, the column beside it on a wide screen. */}
                    <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 mt-6 lg:mt-0 lg:pt-[50px]">
                        <div style={{ background: palette.surface, borderRadius: 12, padding: '16px 18px', display: 'grid', gap: 10 }}>
                            <SkeletonBar palette={palette} width="45%" height={16} />
                            <SkeletonBar palette={palette} width="65%" height={12} />
                            <div className="hidden lg:grid" style={{ gap: 10, marginTop: 8 }}>
                                <SkeletonBar palette={palette} width="80%" height={14} />
                                <SkeletonBar palette={palette} width="60%" height={12} />
                                <SkeletonBar palette={palette} height={16} />
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-start-1 lg:row-start-2" style={{ marginTop: 30, display: 'grid', gap: 18 }}>
                        <SkeletonBar palette={palette} width={96} height={14} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                            {field('first')}
                            {field('last')}
                        </div>
                        {field('dob')}
                        {field('email')}
                    </div>
                </div>
            </div>
        </div>
    );
}
