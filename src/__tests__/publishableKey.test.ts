import { describe, expect, it } from 'vitest';
import { publishableKeySchema } from '@/shared/lib/env';

/**
 * `NEXT_PUBLIC_*` is written into the JavaScript every visitor downloads. The Stripe publishable
 * key belongs there; a secret key does not, and one was shipped that way: the GitHub secret held an
 * `sk_test_` value, so the bundle at the public host carried the API's own key. The build now
 * refuses anything that is not a publishable key.
 */
describe('publishableKeySchema', () => {
    it.each(['pk_test_stub', 'pk_test_51Abc123', 'pk_live_51Abc123'])('accepts %s', (key) => {
        expect(publishableKeySchema.safeParse(key).success).toBe(true);
    });

    it.each(['sk_test_51Abc123', 'sk_live_51Abc123', 'rk_live_51Abc123', 'whsec_abc123', '', ' pk_test_x'])(
        'refuses %p',
        (key) => {
            expect(publishableKeySchema.safeParse(key).success).toBe(false);
        },
    );

    // The message is printed into build logs, which are far less private than the secret store.
    it('never repeats the rejected value', () => {
        const secret = 'sk_test_51ThisMustNotAppearInLogs';
        const result = publishableKeySchema.safeParse(secret);
        expect(result.success).toBe(false);
        expect(JSON.stringify(result.error)).not.toContain(secret);
    });
});
