import { z } from 'zod';

const schema = z.object({
    NEXT_PUBLIC_API_URL:                    z.string().url(),
    NEXT_PUBLIC_SITE_URL:                   z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:     z.string().min(1),
    NEXT_PUBLIC_MAPBOX_TOKEN:               z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN:                 z.string().optional(),
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:   z.string().optional(),
});

export const env = schema.parse({
    NEXT_PUBLIC_API_URL:                    process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL:                   process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:     process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_MAPBOX_TOKEN:               process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN:                 process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:   process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
});
