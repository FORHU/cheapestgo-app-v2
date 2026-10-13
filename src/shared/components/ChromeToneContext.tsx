'use client';

import React from 'react';
import { usePathname } from '@/i18n/navigation';
import { useTheme } from '@/shared/components/ThemeContext';

type Tone = 'light' | 'dark';
/** What a screen can claim: a tone, or "just follow the theme". */
type Declared = Tone | 'theme';

interface ChromeToneValue {
    /** What the open screen claimed, or null when it has claimed nothing yet. */
    declared: Declared | null;
    setDeclared: (d: Declared | null) => void;
}

const ChromeToneContext = React.createContext<ChromeToneValue>({
    declared: null,
    setDeclared: () => {},
});

/**
 * Routes whose chrome inverts, as a path test.
 *
 * This looks like a duplicate of what the screen itself declares, and is not.
 * A declaration lands in an effect, and effects do not run during SSR or before
 * hydration — so without a guess to start from, the search map's nav would
 * paint in the page's tone and flip a frame later. This is that guess. The
 * declaration is what corrects it for a screen that inverts in some of its
 * states but not all of them, which is exactly the search page: its map view
 * inverts, its list view does not.
 */
function routeInvertsChrome(pathname: string): boolean {
    return pathname === '/search';
}

const opposite = (t: Tone): Tone => (t === 'dark' ? 'light' : 'dark');

/**
 * The tone app-level furniture should take on the screen currently open.
 *
 * Almost everywhere this is simply the app theme, and nothing needs to say so.
 * The exception is a screen whose own chrome inverts against something it sits
 * on: the search map runs every floating control opposite the theme so it
 * contrasts the basemap — light theme gets a light basemap under dark controls
 * and dark cards, dark theme the reverse (`uiTone` in the search page).
 *
 * The bottom nav overlaps that map, so on that screen it has to invert with the
 * rest of the chrome rather than with the page, or it lands as a white slab
 * under a row of dark cards. It cannot work that out for itself — it is mounted
 * in the root layout and knows only the pathname, not which of the search
 * page's two view modes is showing — so the screen declares the tone and the
 * furniture reads it.
 */
export function ChromeToneProvider({ children }: { children: React.ReactNode }) {
    const [declared, setDeclared] = React.useState<Declared | null>(null);
    const value = React.useMemo(() => ({ declared, setDeclared }), [declared]);
    return <ChromeToneContext.Provider value={value}>{children}</ChromeToneContext.Provider>;
}

/** The tone to paint furniture in. */
export function useChromeTone(): Tone {
    const { declared } = React.useContext(ChromeToneContext);
    const { theme } = useTheme();
    const pathname = usePathname();

    if (declared === 'theme') return theme;
    if (declared) return declared;
    return routeInvertsChrome(pathname) ? opposite(theme) : theme;
}

/**
 * Claim a tone for as long as the calling component is mounted, releasing it on
 * the way out so the next screen starts from the route guess again.
 *
 * Pass `'theme'` to claim the plain app theme — which is how a screen that
 * inverts in one state and not another can still call this unconditionally, as
 * the rules of hooks require. It is not the same as claiming nothing: claiming
 * nothing falls back to `routeInvertsChrome`, which on `/search` would invert.
 */
export function useDeclareChromeTone(tone: Declared) {
    const { setDeclared } = React.useContext(ChromeToneContext);
    React.useEffect(() => {
        setDeclared(tone);
        return () => setDeclared(null);
    }, [tone, setDeclared]);
}
