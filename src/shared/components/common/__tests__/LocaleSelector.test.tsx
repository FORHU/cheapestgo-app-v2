import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { LocaleSelector } from '../LocaleSelector';

/**
 * Picking a language shows the same page in that language, first time, without reloading it.
 *
 * The translations live in the locale layout, which a client-side navigation renders again, so
 * the switch can stay in the page: the visitor keeps their session and nothing flashes. It used
 * to reload the whole document, because the translations sat in the root layout, which a
 * navigation does not render — switched in place, the address changed while every string stayed
 * English, and the next pick went to /ko/ko.
 *
 * The search the visitor is looking at survives the switch: the query goes with the path.
 */

const pathname = vi.hoisted(() => ({ current: '/search' }));
const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('@/i18n/navigation', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/i18n/navigation')>()),
    usePathname: () => pathname.current,
    useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const realLocation = window.location;
const reload = vi.fn();
const SEARCH = '?destination=Seoul&checkIn=2026-11-13';

function pick(label: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Select language' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByText(label).closest('button')!);
}

beforeEach(() => {
    reload.mockReset();
    routerReplace.mockReset();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, search: SEARCH, hash: '', replace: reload, assign: reload, reload },
    });
});

afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

describe('LocaleSelector', () => {
    it('shows the same page in the new language without reloading it, keeping the search', () => {
        pathname.current = '/search';
        renderWithIntl(<LocaleSelector />);

        pick('KR');

        expect(routerReplace).toHaveBeenCalledWith(`/search${SEARCH}`, { locale: 'ko' });
        expect(reload).not.toHaveBeenCalled();
    });

    it('switches back to English the same way', () => {
        pathname.current = '/deals';
        renderWithIntl(<LocaleSelector />, { locale: 'ko' });

        pick('EN');

        expect(routerReplace).toHaveBeenCalledWith(`/deals${SEARCH}`, { locale: 'en' });
        expect(reload).not.toHaveBeenCalled();
    });

    it('does nothing when the language picked is the one showing', () => {
        renderWithIntl(<LocaleSelector />);

        pick('EN');

        expect(routerReplace).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });
});
