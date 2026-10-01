/**
 * The links the landing page's own header and footer point at.
 *
 * The design names the labels; these are the routes that actually exist. Each link carries a
 * translation key rather than a label, because the footer is on every page in four languages.
 */

export interface ChromeLink {
    /** A key into the locale file, resolved by whichever chrome renders the link. */
    key:  string;
    href: string;
}

/** The header carries no links — only the locale, currency and sign-in controls. */
export const FOOTER_LINKS: ChromeLink[] = [
    { key: 'footer.flights',       href: '/flights/search' },
    { key: 'footer.hotels',        href: '/search' },
    { key: 'help.title',           href: '/help' },
    { key: 'footer.manageBooking', href: '/trips' },
    { key: 'footer.terms',         href: '/terms' },
    { key: 'footer.privacy',       href: '/privacy' },
];

/** Muted slate that lifts to near-white on hover, per the design's `a` rule. */
export const CHROME_LINK =
    'text-[#94a3b8] hover:text-[#f8fafc] transition-colors duration-150';
