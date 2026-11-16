import { beforeEach, describe, expect, it } from 'vitest';
import { openSupportAfterSignIn, takeSupportAfterSignIn } from './supportWidget.store';

/** "Open the chat once they have signed in", carried across the trip to sign in and back. */
describe('openSupportAfterSignIn / takeSupportAfterSignIn', () => {
    beforeEach(() => sessionStorage.clear());

    it('is false when nobody asked', () => {
        expect(takeSupportAfterSignIn()).toBe(false);
    });

    it('is true once, then gone', () => {
        openSupportAfterSignIn(1_000);
        expect(takeSupportAfterSignIn(2_000)).toBe(true);
        expect(takeSupportAfterSignIn(3_000)).toBe(false);
    });

    it('lapses after half an hour, so a later sign-in is not met by a chat nobody wants', () => {
        openSupportAfterSignIn(0);
        expect(takeSupportAfterSignIn(30 * 60 * 1000)).toBe(false);
        expect(sessionStorage.length).toBe(0);
    });

    it('ignores a value it did not write', () => {
        sessionStorage.setItem('cg-support-after-sign-in', 'soon');
        expect(takeSupportAfterSignIn()).toBe(false);
    });
});
