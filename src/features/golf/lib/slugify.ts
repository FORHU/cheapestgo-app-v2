/**
 * The rule api-v2 makes a course's slug with (src/lib/golf/courseInput.ts), so the admin form can
 * show the slug a new course will get. The server applies it again; this is only the preview.
 */
export function slugify(...parts: string[]): string {
    return parts
        .join(' ')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120)
        .replace(/-+$/, '');
}
