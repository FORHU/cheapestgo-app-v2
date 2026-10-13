/**
 * The brand being shown on this request — the server half of the brand preview.
 *
 * Kept apart from `brand.ts` because it reads the request, and `next/headers` cannot be
 * imported by anything a client component pulls in. Everything pure — what the gate is, how a
 * value is parsed, which wins — lives in `brand.ts` where it is tested without a request.
 *
 * Browser code does not call this. The root layout resolves the brand once and hands it down
 * through `BrandProvider`, so the header the visitor sees cannot disagree with the metadata and
 * copy the server rendered.
 */
import { cookies, headers } from 'next/headers';
import {
    BRAND_PREVIEW_COOKIE,
    DEPLOYMENT_BRAND_NAME,
    brandPreviewEnabled,
    resolveBrandName,
} from '@/shared/lib/brand';

/**
 * The brand to show on this request.
 *
 * With the preview off it returns the build's brand without touching the request, which is what
 * keeps a production page statically renderable: reading cookies or headers is what opts a route
 * into per-request rendering.
 */
export async function getBrandName(): Promise<string> {
    if (!brandPreviewEnabled()) return DEPLOYMENT_BRAND_NAME;

    const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
    return resolveBrandName({
        deployment: DEPLOYMENT_BRAND_NAME,
        enabled:    true,
        cookie:     jar.get(BRAND_PREVIEW_COOKIE)?.value,
        host:       requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    });
}
