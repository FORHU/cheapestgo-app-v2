import { create } from 'zustand';

/**
 * Lets a page outside the Support Chat ask for it to open: "Ask about tee times" on a golf course.
 *
 * The widget's open state lives in `useSupportChat`'s reducer, because opening also loads the
 * customer's conversation, and only the first time. So this carries a request rather than the
 * state: each `requestOpen()` bumps a counter, and the mounted widget answers it by opening itself.
 */
interface SupportWidgetRequests {
    openRequests: number;
    requestOpen:  () => void;
}

export const useSupportWidget = create<SupportWidgetRequests>((set) => ({
    openRequests: 0,
    requestOpen:  () => set((s) => ({ openRequests: s.openRequests + 1 })),
}));
