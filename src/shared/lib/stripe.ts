/* eslint-disable @typescript-eslint/no-explicit-any */

let stripePromise: Promise<any> | null = null;

export async function getStripe(): Promise<any> {
    if (!stripePromise) {
        const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!key) {
            console.error('[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
            return null;
        }
        stripePromise = import('@stripe/stripe-js').then((mod) => mod.loadStripe(key));
    }
    return stripePromise;
}
