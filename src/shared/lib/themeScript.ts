/**
 * The inline script that puts the saved theme on <html> before the first paint (root layout).
 *
 * Kept here, beside its hash, because the staff host's CSP (src/shared/lib/staffSecurityHeaders.ts)
 * allows it by hash rather than by nonce: a nonce would mean reading the request in the root
 * layout, which would make every storefront page render per request. Change the script and the
 * hash must change with it — `staff-security-headers.test.ts` fails until it does, because a stale
 * hash means the staff host silently blocks the script and every staff page loses its theme.
 */
export const THEME_SCRIPT =
    "try{var t=localStorage.getItem('theme');document.documentElement.classList.add(t==='dark'?'dark':'light')}catch(e){document.documentElement.classList.add('light')}";

/** `sha256` of {@link THEME_SCRIPT}, base64, as a CSP source expects it. */
export const THEME_SCRIPT_SHA256 = 'C+j0oSyC9cygbf8Wng97sFTYW6PKWimEz6CW/w/KD9k=';
