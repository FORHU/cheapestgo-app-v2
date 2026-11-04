import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useAuthStore } from '@/shared/auth/store';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

import { AskTeeTimesButton } from '@/features/golf/components/ask-tee-times-button';

const signedIn = (yes: boolean) =>
    useAuthStore.setState({ user: yes ? ({ id: 'u1', email: 'golfer@example.com' } as never) : null, isLoading: false });

beforeEach(() => {
    push.mockReset();
    useSupportWidget.setState({ openRequests: 0 });
    window.history.replaceState(null, '', '/golf/wack-wack');
});

describe('Ask about tee times', () => {
    it('asks the support chat to open for someone signed in', async () => {
        signedIn(true);
        renderWithIntl(<AskTeeTimesButton />);
        await userEvent.setup().click(screen.getByRole('button', { name: en.golf.askTeeTimes }));
        expect(useSupportWidget.getState().openRequests).toBe(1);
        expect(push).not.toHaveBeenCalled();
    });

    it('sends a signed-out visitor to sign in, and back here after', async () => {
        signedIn(false);
        renderWithIntl(<AskTeeTimesButton />);
        expect(screen.getByText(en.golf.askSignIn)).toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole('button', { name: en.golf.askTeeTimes }));
        expect(push).toHaveBeenCalledWith('/login?redirect=%2Fgolf%2Fwack-wack');
        expect(useSupportWidget.getState().openRequests).toBe(0);
    });

    it('waits while it is still finding out who is signed in', () => {
        useAuthStore.setState({ user: null, isLoading: true });
        renderWithIntl(<AskTeeTimesButton />);
        expect(screen.getByRole('button', { name: en.golf.askTeeTimes })).toBeDisabled();
    });
});

describe('Ask about this tee time', () => {
    it('asks with a draft naming the tee time, for the customer to send', async () => {
        signedIn(true);
        renderWithIntl(<AskTeeTimesButton draft="Hi! I'd like to play Wack Wack at 07:30." />);
        await userEvent.setup().click(screen.getByRole('button', { name: en.golf.teeTimes.askThis }));
        expect(useSupportWidget.getState()).toMatchObject({ openRequests: 1, draft: "Hi! I'd like to play Wack Wack at 07:30." });
    });
});
