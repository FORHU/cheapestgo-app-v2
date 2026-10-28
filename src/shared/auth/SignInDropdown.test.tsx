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

        expect(panel.className).toContain('bg-[#0f172a]/90');
        expect(panel.className).not.toContain('bg-white/60');
        expect(panel.innerHTML).toContain('text-white');
        // Nothing that would turn dark text on in a light theme.
        expect(panel.innerHTML).not.toContain('text-slate-900');
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
