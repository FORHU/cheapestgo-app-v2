/**
 * The sidebar lists every back-office page.
 *
 * It listed five of twenty-one, so the rest were reachable only by typing the URL and read as
 * unmigrated work. Comparing against the filesystem rather than a second hand-written list,
 * because a list that has to be updated alongside the sidebar is the same bug one step away.
 */

import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminSidebar } from '@/features/admin/components/admin-sidebar';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/overview' }));

/** Route segments under the (dashboard) group — one per back-office page. */
function pagesOnDisk(): string[] {
    const dir = path.join(process.cwd(), 'src/app/admin/(dashboard)');
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'page.tsx')))
        .map(d => `/admin/${d.name}`)
        .sort();
}

describe('AdminSidebar', () => {
    it('links every page under (dashboard)', () => {
        render(<AdminSidebar />);

        const linked = screen
            .getAllByRole('link')
            .map(a => a.getAttribute('href') ?? '')
            .filter(h => h.startsWith('/admin/'))
            .sort();

        expect(linked).toEqual(pagesOnDisk());
    });

    it('groups them rather than listing twenty-one in a row', () => {
        render(<AdminSidebar />);
        for (const title of ['Menu', 'Content', 'General', 'Integrations']) {
            expect(screen.getByText(title)).toBeInTheDocument();
        }
    });
});
