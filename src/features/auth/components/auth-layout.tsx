import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { brandWordmark } from '@/shared/lib/brand';

/**
 * The shell every auth screen sits in.
 *
 * A split panel: the form on one side, the brand on the other. That layout appears nowhere else
 * in the app, so the thing holding it to the product is the language rather than the shape —
 * the header's wordmark treatment, the accent tokens, `font-display`, and the same poster and
 * scrim the landing page uses. Built as one component because login, register and the two
 * password screens had been copying the same markup, and a shell copied four times is a shell
 * that drifts three ways.
 *
 * The brand side is `hidden lg:flex`: on a phone it would push the form below the fold, and the
 * form is the entire reason anyone is on this page.
 */
export function AuthLayout({
    title,
    subtitle,
    children,
    /** One line on the brand panel. Different per screen: signing in is not signing up. */
    pitch,
}: {
    title:    string;
    subtitle: string;
    children: ReactNode;
    pitch:    string;
}) {
    const wordmark = brandWordmark(process.env.NEXT_PUBLIC_BRAND_NAME);

    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[1fr_1.1fr] bg-alabaster dark:bg-obsidian">
            {/* ── The form ──────────────────────────────────────────────────── */}
            <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-10 lg:min-h-0">
                <div className="mx-auto w-full max-w-sm">
                    <Link href="/" className="inline-block transition-opacity hover:opacity-80">
                        {/* The same treatment as the header: no icon, and the tail carries the
                            accent. A plane glyph used to stand in for this and appears nowhere
                            else in the product. */}
                        <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {wordmark.head}
                            <span className="text-alabaster-accent dark:text-obsidian-accent">{wordmark.tail}</span>
                        </span>
                    </Link>

                    <h1 className="mt-8 font-display text-[clamp(26px,3vw,32px)] font-bold leading-tight tracking-[-0.025em] text-slate-900 dark:text-white">
                        {title}
                    </h1>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>

                    <div className="mt-8">{children}</div>
                </div>
            </div>

            {/* ── The brand side ────────────────────────────────────────────── */}
            <div className="relative hidden overflow-hidden lg:block">
                {/*
                    The poster the landing already ships, not the video: this is a page people
                    pass through in seconds, and a 1080p loop for that is a cost with nothing
                    behind it. `aria-hidden` because it says nothing a screen reader needs —
                    the pitch beside it is real text.
                */}
                <div
                    aria-hidden
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'url(/videos/landing-ocean-poster.jpg)' }}
                />
                {/*
                    The landing's own scrim, reused rather than re-derived. It was chosen against
                    this exact frame, whose wing and sunlit water are close to white, to hold
                    light text at 4.5:1.
                */}
                <div
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,13,20,0.62)_0%,rgba(9,13,20,0.55)_45%,rgba(7,10,15,0.82)_100%)]"
                />

                <div className="relative flex h-full flex-col justify-end p-12">
                    <p className="max-w-md font-display text-[clamp(24px,2.4vw,34px)] font-bold leading-[1.15] tracking-[-0.03em] text-white">
                        {pitch}
                    </p>
                    <p className="mt-3 text-sm text-white/70">
                        {wordmark.head}{wordmark.tail}
                    </p>
                </div>
            </div>
        </div>
    );
}
