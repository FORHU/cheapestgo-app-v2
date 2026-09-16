import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

/**
 * The social preview image, drawn per request (v1's /api/og, ported in C7).
 *
 * Why this lives in app-v2 rather than api-v2: an OG image is presentation, not domain logic
 * ([ADR-0017](../../../../docs/adr/0017-api-v2-owns-all-domain-logic.md) draws that line), and
 * Next renders it natively at the edge while Express would need a font pipeline to do the same
 * thing worse. It reaches no database and calls no service, so app-v2 is still a frontend.
 *
 * The *capability* is ported, not v1's artwork: v1 carries several hand-tuned design variants
 * behind `?design=`, which is exactly the kind of thing
 * [ADR-0016](../../../../docs/adr/0016-parity-is-functional-not-visual.md) says does not cross.
 * v2 draws its own, from its own tokens.
 *
 *   /api/og                          the site's default card
 *   /api/og?title=Seoul%20hotels     a page's own title
 *   /api/og?subtitle=From%20%2440    a second line, optional
 */
export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

/** Long titles wrap rather than overflow; past this they are cut, because a card is not a page. */
const MAX_TITLE = 90;
const MAX_SUBTITLE = 120;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const title = (searchParams.get('title') ?? 'Stop overpaying for travel.').slice(0, MAX_TITLE);
    const subtitle = (searchParams.get('subtitle') ?? 'Real prices. No markup. No surprises.').slice(0, MAX_SUBTITLE);

    return new ImageResponse(
        (
            <div
                style={{
                    width: WIDTH,
                    height: HEIGHT,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 72,
                    background: '#060818',
                    color: '#f8fafc',
                    fontFamily: 'sans-serif',
                }}
            >
                {/* A single soft light source, top-right, so the card is not a flat rectangle. */}
                <div
                    style={{
                        position: 'absolute',
                        top: -260,
                        right: -180,
                        width: 760,
                        height: 760,
                        borderRadius: 999,
                        background: 'radial-gradient(circle, rgba(37,99,235,0.45) 0%, rgba(6,8,24,0) 70%)',
                        display: 'flex',
                    }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 30, letterSpacing: -0.5 }}>
                    <span style={{ color: '#cbd5e1' }}>cheapest</span>
                    <span style={{ fontWeight: 700 }}>Go</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
                        {title}
                    </div>
                    <div style={{ fontSize: 30, color: '#94a3b8' }}>{subtitle}</div>
                </div>
            </div>
        ),
        { width: WIDTH, height: HEIGHT },
    );
}
