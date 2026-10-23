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
 */
export function LandingFooter() {
    const t = useTranslations();
    const brand = useBrandName();
    return (
        <footer>
            <div className="mx-auto max-w-[1240px] px-6 pt-8 pb-10">
                <div className="flex flex-wrap items-center justify-between gap-6 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-5">
                    <LogoWordmark height={36} />

                    <nav className="flex flex-wrap gap-6 text-[13px]">
                        {FOOTER_LINKS.map(({ key, href }) => (
                            <Link key={key} href={href} className={CHROME_LINK}>
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
