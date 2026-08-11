import Link from 'next/link';
import { LogoWordmark } from './logo-wordmark';
import { CHROME_LINK, FOOTER_LINKS } from '@/features/landing/lib/chrome-links';

/**
 * The landing page's own footer: one row of wordmark, links and the legal line,
 * stacking to a left-aligned column below 760px.
 */
export function LandingFooter() {
    return (
        <footer>
            <div className="mx-auto max-w-[1240px] px-6 pt-8 pb-10">
                <div className="flex flex-wrap items-center justify-between gap-6 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-5">
                    <LogoWordmark height={20} />

                    <nav className="flex flex-wrap gap-6 text-[13px]">
                        {FOOTER_LINKS.map(({ label, href }) =>
                            href.startsWith('mailto:') ? (
                                <a key={label} href={href} className={CHROME_LINK}>
                                    {label}
                                </a>
                            ) : (
                                <Link key={label} href={href} className={CHROME_LINK}>
                                    {label}
                                </Link>
                            )
                        )}
                    </nav>

                    <span className="text-xs text-[#64748b]">
                        © {new Date().getFullYear()} CheapestGo · Manila
                    </span>
                </div>
            </div>
        </footer>
    );
}
