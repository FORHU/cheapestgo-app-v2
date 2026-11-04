import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GolfBookView } from '@/features/golf/components/golf-book-view';

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
