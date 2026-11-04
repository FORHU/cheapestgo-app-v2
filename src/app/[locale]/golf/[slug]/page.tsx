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

export default async function GolfCoursePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (await lookUp(slug) === 'missing') notFound();
    return <GolfCourseView slug={slug} />;
}
