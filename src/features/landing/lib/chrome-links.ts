/**
 * The links the landing page's own header and footer point at.
 *
 * The design names the labels; these are the routes that actually exist —
 * `/search` is the hotel results page and Help is the support mailbox, since
 * neither `/hotels/search` nor `/help` is a route in this app.
 */

export interface ChromeLink {
    label: string;
    href: string;
}

/** The header carries no links — only the locale, currency and sign-in controls. */
export const FOOTER_LINKS: ChromeLink[] = [
    { label: 'Flights', href: '/flights/search' },
    { label: 'Hotels', href: '/search' },
    { label: 'Help', href: 'mailto:support@cheapestgo.com' },
    { label: 'Manage booking', href: '/trips' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
];

/** Muted slate that lifts to near-white on hover, per the design's `a` rule. */
export const CHROME_LINK =
    'text-[#94a3b8] hover:text-[#f8fafc] transition-colors duration-150';
