'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LogoWordmark } from './logo-wordmark';
import { CHROME_LINK, FOOTER_LINKS } from '@/features/landing/lib/chrome-links';
import { useBrandName } from '@/shared/components/BrandProvider';

/**
 * The landing page's own footer: one row of wordmark, links and the legal line,
 * stacking to a left-aligned column below 760px.
 *
 * A client component because the brand it names is the one being shown on this request, which a
 * deployment with the brand preview on resolves per visitor and hands down through context.
 *
 * `tone` is the wordmark's. The landing page is dark whatever the theme, so `onDark` is the default;
 * every other page follows the theme and passes `default` (`shared/components/footer.tsx`), or the
 * near-white head of the wordmark disappears into the light ground.
 */
export function LandingFooter({ tone = 'onDark' }: { tone?: 'default' | 'onDark' }) {
    const t = useTranslations();
    const brand = useBrandName();
    return (
        <footer>
            <div className="mx-auto max-w-[1240px] px-6 pt-8 pb-10">
                <div className="flex flex-wrap items-center justify-between gap-6 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-5">
                    <LogoWordmark height={36} tone={tone} />

                    {/* Below `md` each link is a 44px row for a thumb — at its 20px line
                        height the wrapped rows were a hard target — and the row gap closes
                        up to keep the footer about the height it was. */}
                    <nav className="flex flex-wrap gap-x-6 gap-y-0 text-[13px] md:gap-6">
                        {FOOTER_LINKS.map(({ key, href }) => (
                            <Link key={key} href={href} className={`${CHROME_LINK} max-md:inline-flex max-md:min-h-11 max-md:items-center`}>
                                {t(key)}
                            </Link>
                        ))}
                    </nav>

                    <span className="text-xs text-[#64748b]">
                        © {new Date().getFullYear()} {brand} · Manila
                    </span>
                </div>
            </div>
        </footer>
    );
}
