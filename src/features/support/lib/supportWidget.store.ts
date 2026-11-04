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
