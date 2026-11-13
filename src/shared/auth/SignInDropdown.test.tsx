import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The profile circle and the dropdown behind it, drawn in the app's own palette.
 *
 * The circle was blue → purple, a colour the brand does not have, and the panel followed the
 * app theme even on the landing page, which is dark whatever the theme is — so a light panel
 * opened over a dark page. The language and currency menus already solved the second with a
 * tone; this takes the same one.
 */

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    usePathname: () => '/',
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useLogout: () => ({ mutate: vi.fn(), isPending: false }) }));

const auth: { user: unknown } = { user: null };
vi.mock('@/shared/stores/auth.store', () => ({
    useAuthStore: (select?: (s: unknown) => unknown) => (select ? select({ openAuthModal: vi.fn() }) : auth),
}));

import SignInDropdown from './SignInDropdown';

const SIGNED_IN = { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan' };

beforeEach(() => { auth.user = SIGNED_IN; });

const openPanel = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'account' }));
    return (await screen.findByText('accountSettings')).closest('div.absolute') as HTMLElement;
};

describe('the profile circle', () => {
    it('is drawn in the brand gradient, blue-600 to cyan-500, with no purple', async () => {
        render(<SignInDropdown />);
        const circle = (await screen.findByRole('button', { name: 'account' })).firstElementChild as HTMLElement;

        expect(circle.className).toContain('from-blue-600');
        expect(circle.className).toContain('to-cyan-500');
        expect(circle.className).not.toMatch(/purple/);
    });

    it('is the same in the panel that opens under it', async () => {
        render(<SignInDropdown />);
        const panel = await openPanel();

        expect(panel.innerHTML).toContain('from-blue-600');
        expect(panel.innerHTML).not.toMatch(/purple/);
    });
});

describe('the panel', () => {
    it('is the language and currency menus\' glass when it follows the theme', async () => {
        render(<SignInDropdown />);
        const panel = await openPanel();

        expect(panel.className).toContain('backdrop-blur-[18px]');
        expect(panel.className).toContain('bg-white/60');
        // Themed text, so the light theme's panel is not white-on-white.
        expect(panel.innerHTML).toContain('text-slate-900 dark:text-white');
    });

    it('is a dark panel with white text on a page that is dark whatever the theme', async () => {
        render(<SignInDropdown tone="onDark" />);
        const panel = await openPanel();

        expect(panel.className).toContain('bg-white/[0.18]');
        expect(panel.className).not.toContain('bg-white/60');
        expect(panel.innerHTML).toContain('text-white');
        // Nothing that would turn dark text on in a light theme.
        expect(panel.innerHTML).not.toContain('text-slate-900');
    });
});

/**
 * On the search toolbar the panel is drawn from the bar's own palette, not from a skin.
 *
 * That page hardcodes `dark` on its root and inverts the bar against the basemap, so a `dark:`
 * variant resolves to the dark skin there whatever the bar is. On a light bar that was white
 * text on a near-white glass panel over a light map — the name, email, Account Settings and
 * Sign out all but vanished. The language and currency menus took `chrome` for this; the
 * account menu has to as well.
 */
describe('the panel on a toolbar with its own palette', () => {
    const LIGHT = {
        surface: '#FFFFFF', text: '#0f172a', border: '#e2e8f0', menu: '#FFFFFF',
        hover: '#f1f5f9', shadow: '0 8px 24px rgba(15,23,42,0.16)', danger: '#b91c1c',
    };

    it('is the palette\'s opaque menu ground, not translucent glass', async () => {
        render(<SignInDropdown chrome={LIGHT} />);
        const panel = await openPanel();

        expect(panel).toHaveStyle({ background: '#FFFFFF' });
        expect(panel.className).not.toContain('backdrop-blur');
        expect(panel.className).not.toMatch(/bg-white\//);
    });

    it('draws name, email, settings and sign-out from the palette, with nothing that follows `dark:`', async () => {
        render(<SignInDropdown chrome={LIGHT} />);
        const panel = await openPanel();

        expect(screen.getByText('Billy Busilan')).toHaveStyle({ color: '#0f172a' });
        expect(screen.getByText('billy@example.com')).toHaveStyle({ color: '#0f172a' });
        expect(screen.getByText('accountSettings').closest('a')).toHaveStyle({ color: '#0f172a' });
        expect(screen.getByText('signOut').closest('button')).toHaveStyle({ color: '#b91c1c' });
        expect(panel.innerHTML).not.toMatch(/dark:text-/);
    });

    it('lights a row under the cursor with the palette\'s hover fill', async () => {
        render(<SignInDropdown chrome={LIGHT} />);
        await openPanel();
        const row = screen.getByText('accountSettings').closest('a') as HTMLElement;

        fireEvent.mouseEnter(row);
        expect(row).toHaveStyle({ background: '#f1f5f9' });
        fireEvent.mouseLeave(row);
        expect(row).not.toHaveStyle({ background: '#f1f5f9' });
    });

    it('falls back to the palette\'s own text for sign-out when it carries no danger colour', async () => {
        const { danger: _danger, ...bare } = LIGHT;
        render(<SignInDropdown chrome={bare} />);
        await openPanel();

        expect(screen.getByText('signOut').closest('button')).toHaveStyle({ color: '#0f172a' });
    });
});

describe('signed out', () => {
    beforeEach(() => { auth.user = null; });

    it('fills the sign-in button and the panel\'s banner with the brand gradient, not a flat blue', async () => {
        render(<SignInDropdown />);
        const trigger = await screen.findByRole('button', { name: 'nav.signIn' });
        expect(trigger.className).toContain('from-blue-600');
        expect(trigger.className).toContain('to-cyan-500');
        expect(trigger.className).not.toContain('bg-blue-600');

        fireEvent.click(trigger);
        const banner = (await screen.findByText('membersSave')).parentElement as HTMLElement;
        expect(banner.className).toContain('to-cyan-500');
        expect(banner.className).not.toContain('to-blue-700');
    });
});
