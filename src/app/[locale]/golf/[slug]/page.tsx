import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GolfCourseView } from '@/features/golf/components/golf-course-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * The course's name for the tab, or `missing` when api-v2 says no published course has this slug.
 * An outage is neither: the page renders and the view says what went wrong. Not cached, so a course
 * published a moment ago is not a 404 for anyone.
 */
async function lookUp(slug: string): Promise<{ name: string } | 'missing' | null> {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    try {
        const res = await fetch(`${base}/golf/courses/${encodeURIComponent(slug)}`, {
            signal: AbortSignal.timeout(4000),
            cache:  'no-store',
        });
        if (res.status === 404) return 'missing';
        if (!res.ok) return null;
        const body = await res.json() as { data?: { name?: string } };
        return body.data?.name ? { name: body.data.name } : null;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const [found, t] = await Promise.all([lookUp(slug), getTranslations('golf')]);
    return {
        title:      found && found !== 'missing' ? t('courseMetaTitle', { name: found.name }) : t('metaTitle'),
        alternates: await hreflangAlternates(`/golf/${slug}`),
    };
}

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : undefined);

/**
 * The tee time picked, read from the address on the server so the picker opens on it: a shared link,
 * or a visitor coming back from signing in. Only shapes are checked here; api-v2 decides the rest.
 */
function selection(query: Query) {
    const date = one(query.date);
    const players = Number(one(query.players));
    const time = one(query.time);
    return {
        date:    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
        players: Number.isInteger(players) && players >= 1 && players <= 4 ? players : undefined,
        time:    time && /^[0-9a-f-]{36}$/i.test(time) ? time : undefined,
    };
}

export default async function GolfCoursePage({ params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Query>;
}) {
    const [{ slug }, query] = await Promise.all([params, searchParams]);
    if (await lookUp(slug) === 'missing') notFound();
    return <GolfCourseView slug={slug} initial={selection(query)} />;
}
