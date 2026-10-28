import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';
import { canonicalBrandName } from '@/shared/lib/brand';

export const runtime = 'nodejs';
/**
 * Rendered on request, not at build time.
 *
 * Prerendering it makes `next build` import @vercel/og's font loader in the export worker,
 * which resolves the bundled Noto Sans through `fileURLToPath` on a path it builds itself —
 * and on Windows that path comes out as `.\file:\C:\...`, which is not a URL. The build
 * then fails outright, so nobody on Windows can build the app at all.
 *
 * The card is a single static image per brand, so generating it on first request and
 * letting the CDN hold it costs nothing a prerender would have saved.
 */
export const dynamic = 'force-dynamic';
export const alt = canonicalBrandName(process.env.NEXT_PUBLIC_BRAND_NAME);
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The card a shared link shows.
 *
 * Generated rather than a static file, for two reasons. It comes out at exactly 1200×630,
 * the size every scraper expects — the previous arrangement pointed `og:image` at
 * `Web_Logo_Light.png` while declaring 1200×630, and that file is 875×368, so platforms
 * that trust the declaration reserved a box the image could not fill and letterboxed or
 * cropped the logo. And it is brand-aware at build time, so an AirangGo build produces an
 * AirangGo card from the same source.
 *
 * `openGraph.images` and `twitter.images` must stay absent from the metadata in
 * `app/layout.tsx`: an explicit entry there overrides this file, which is how the
 * mis-sized logo came to be served in the first place.
 */
export default function Image() {
    const brandName = canonicalBrandName(process.env.NEXT_PUBLIC_BRAND_NAME);
    const brandLogo = process.env.NEXT_PUBLIC_BRAND_LOGO ?? '/Web_Logo_Light.png';
    const tagline = process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? 'Book Flights & Hotels at the Lowest Price';

    // Inlined as a data URI because Satori cannot fetch from the filesystem. A missing or
    // unreadable logo falls back to the wordmark rather than rendering an empty card.
    let logoSrc: string | null = null;
    try {
        const logoPath = path.join(process.cwd(), 'public', brandLogo.replace(/^\//, ''));
        const buffer = fs.readFileSync(logoPath);
        const ext = path.extname(brandLogo).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        logoSrc = `data:${mime};base64,${buffer.toString('base64')}`;
    } catch { /* fall through to the wordmark */ }

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '24px',
                    background: 'linear-gradient(160deg, #f5f7fa 0%, #ffffff 60%, #eef1f8 100%)',
                }}
            >
                {logoSrc ? (
                    // Rendered by next/og (Satori), not the browser DOM — next/image does
                    // not work here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoSrc} alt="" style={{ maxWidth: 600, maxHeight: 220, objectFit: 'contain' }} />
                ) : (
                    <span style={{ fontSize: 100, fontWeight: 900, color: '#1a2035' }}>
                        {brandName}
                    </span>
                )}
                <span style={{ fontSize: 32, fontWeight: 600, color: '#6b7280', letterSpacing: '-0.5px' }}>
                    {tagline}
                </span>
            </div>
        ),
        { width: 1200, height: 630 },
    );
}
