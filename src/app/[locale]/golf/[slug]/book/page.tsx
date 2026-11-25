import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GolfBookView } from '@/features/golf/components/golf-book-view';

/**
 * This whole page is driven by `searchParams` (`teeTime`, `players`, `date`) and calls
 * `notFound()` off them below. Without forcing the route fully dynamic, Next.js may prefetch a
 * static shell of this route for the `<Link>` that sends a customer here (tee-time-picker.tsx) —
 * a prefetch request that carries the path but not the query string. That shell render sees
 * `searchParams.teeTime` as empty, hits the same `notFound()`, and the client router cache can
 * then serve that cached not-found result for the real navigation that follows, even though the
 * real URL has a perfectly valid teeTime. `flights/search/page.tsx` is the same shape of page
 * (entirely searchParams-driven) and carries the same fix.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('golf.booking');
    return {
        title:  t('metaTitle'),
        robots: { index: false, follow: false },
    };
}

type Query = Record<string, string | string[] | undefined>;
const UUID = /^[0-9a-f-]{36}$/i;

/** Only shapes are checked here; whether the tee time can still be booked is api-v2's to say. */
export default async function GolfBookPage({ params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Query>;
}) {
    const [{ slug }, query] = await Promise.all([params, searchParams]);
    const teeTime = typeof query.teeTime === 'string' ? query.teeTime.trim() : '';
    if (!UUID.test(teeTime)) notFound();
    const asked = Number(query.players);
    const players = Number.isInteger(asked) && asked >= 1 && asked <= 4 ? asked : 2;
    const extras = typeof query.extras === 'string' ? query.extras : undefined;
    const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : undefined;
    return <GolfBookView slug={slug} teeTimeId={teeTime} players={players} date={date} extras={extras} />;
}
