import { create } from 'zustand';

/**
 * Lets a page outside the Support Chat ask for it to open: "Ask about tee times" on a golf course.
 *
 * The widget's open state lives in `useSupportChat`'s reducer, because opening also loads the
 * customer's conversation, and only the first time. So this carries a request rather than the
 * state: each `requestOpen()` bumps a counter, and the mounted widget answers it by opening itself.
 *
 * A request may carry a draft — "I'd like to play this course at 07:30" — which the panel puts in its
 * message box if the box is empty, and then takes from here. The customer sends it; nothing is sent
 * for them.
 */
interface SupportWidgetRequests {
    openRequests: number;
    draft:        string | null;
    requestOpen:  (draft?: string) => void;
    /** The panel's side: the pending draft, once. */
    takeDraft:    () => string | null;
}

export const useSupportWidget = create<SupportWidgetRequests>((set, get) => ({
    openRequests: 0,
    draft:        null,
    requestOpen:  (draft) => set((s) => ({ openRequests: s.openRequests + 1, draft: draft?.trim() || null })),
    takeDraft:    () => {
        const { draft } = get();
        if (draft !== null) set({ draft: null });
        return draft;
    },
}));

/**
 * "Open the chat once they have signed in" — set when a signed-out visitor goes to sign in from
 * the support prompt, so the chat they came for is open when they get back.
 *
 * In sessionStorage rather than the store: Google sign-in and "create account" leave the page and
 * come back to a fresh one. It expires, so a visitor who wandered off and signed in an hour later
 * for some other reason is not met by a chat they no longer want. Storage can be missing or throw
 * (a private window, blocked site data); the chat then just does not open by itself.
 */
const AFTER_SIGN_IN_KEY = 'cg-support-after-sign-in';
const AFTER_SIGN_IN_TTL_MS = 30 * 60 * 1000;

export function openSupportAfterSignIn(now = Date.now()): void {
    try { sessionStorage.setItem(AFTER_SIGN_IN_KEY, String(now)); } catch { /* see above */ }
}

/** True once, if a sign-in for the chat is still fresh; clears the flag either way. */
export function takeSupportAfterSignIn(now = Date.now()): boolean {
    try {
        const raw = sessionStorage.getItem(AFTER_SIGN_IN_KEY);
        if (raw === null) return false;
        sessionStorage.removeItem(AFTER_SIGN_IN_KEY);
        const at = Number(raw);
        return Number.isFinite(at) && now - at >= 0 && now - at < AFTER_SIGN_IN_TTL_MS;
    } catch {
        return false;
    }
}
