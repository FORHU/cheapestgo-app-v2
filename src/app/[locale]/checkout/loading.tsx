import { CheckoutSkeleton } from '@/features/checkout/components/checkout-skeleton';

/**
 * Shown the moment checkout is navigated to, while its route loads. Without it the page that
 * asked stayed blank under the layout's footer, which on a phone was the whole screen.
 */
export default function CheckoutLoading() {
    return <CheckoutSkeleton />;
}
