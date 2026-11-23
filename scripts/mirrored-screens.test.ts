// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    EXEMPT_LABEL,
    ManifestError,
    annotation,
    decide,
    failureMessage,
    linkedMobilePulls,
    matchesPattern,
    parseManifest,
    run,
    touchedScreens,
    unmatchedPatterns,
    type GateIO,
    type MirroredScreen,
} from './mirrored-screens';

/**
 * The mirrored-screens gate (issue #32, docs/adr/0008): a pull request touching a screen mobile
 * mirrors fails unless it links the mobile pull request or carries the exemption label.
 */

const ABOUT: MirroredScreen = {
    name: 'About',
    v2: ['src/app/[locale]/about/**'],
    flutter: ['lib/features/about/views/about_view.dart'],
};
const LINK = 'https://github.com/FORHU/cheapest-go-mobile/pull/88';

describe('matchesPattern', () => {
    it('treats [brackets] and (parentheses) as the folders they name', () => {
        // In glob syntax [locale] is a one-letter class, and the gate would match nothing.
        expect(matchesPattern('src/app/[locale]/about/page.tsx', 'src/app/[locale]/about/**')).toBe(true);
        expect(matchesPattern('src/app/l/about/page.tsx', 'src/app/[locale]/about/**')).toBe(false);
        expect(matchesPattern('src/app/admin/(dashboard)/support/page.tsx', 'src/app/admin/(dashboard)/**')).toBe(true);
    });

    it('matches everything below a folder, and only that folder', () => {
        expect(matchesPattern('src/app/[locale]/about/sections/hero.tsx', 'src/app/[locale]/about/**')).toBe(true);
        expect(matchesPattern('src/app/[locale]/about-us/page.tsx', 'src/app/[locale]/about/**')).toBe(false);
        expect(matchesPattern('src/app/[locale]/about', 'src/app/[locale]/about/**')).toBe(false);
    });

    it('keeps * inside one folder and lets ** cross any number', () => {
        expect(matchesPattern('src/features/support/components/SupportWidget.tsx', 'src/features/support/components/*.tsx')).toBe(true);
        expect(matchesPattern('src/features/support/components/deep/Panel.tsx', 'src/features/support/components/*.tsx')).toBe(false);
        expect(matchesPattern('src/features/support/components/deep/Panel.tsx', 'src/features/**/Panel.tsx')).toBe(true);
        expect(matchesPattern('src/features/Panel.tsx', 'src/features/**/Panel.tsx')).toBe(true);
    });

    it('matches a plain path exactly, dots and all', () => {
        expect(matchesPattern('src/shared/components/header.tsx', 'src/shared/components/header.tsx')).toBe(true);
        expect(matchesPattern('src/shared/components/headerXtsx', 'src/shared/components/header.tsx')).toBe(false);
        expect(matchesPattern('src/shared/components/header.tsx.bak', 'src/shared/components/header.tsx')).toBe(false);
    });
});

describe('parseManifest', () => {
    const valid = JSON.stringify({ _comment: ['for people'], screens: [ABOUT] });

    it('reads a valid manifest', () => {
        expect(parseManifest(valid)).toEqual([ABOUT]);
    });

    it('lists every problem at once', () => {
        const bad = JSON.stringify({
            screens: [
                { name: 'About', v2: ['src/app/[locale]/about/'], flutter: [] },
                { name: 'about', v2: ['/src/x.tsx'], flutter: ['lib/x.dart'], extra: true },
                { v2: ['src/y.tsx'], flutter: ['lib/y.dart'] },
            ],
            surprise: 1,
        });
        let error: unknown;
        try {
            parseManifest(bad);
        } catch (e) {
            error = e;
        }
        expect(error).toBeInstanceOf(ManifestError);
        const problems = (error as ManifestError).problems.join('\n');
        expect(problems).toMatch(/unknown top-level key `surprise`/);
        expect(problems).toMatch(/end a folder with \/\*\*/);
        expect(problems).toMatch(/"About".flutter needs at least one path/);
        expect(problems).toMatch(/"about" is listed twice/);
        expect(problems).toMatch(/starts with \/ or \.\//);
        expect(problems).toMatch(/unknown key `extra`/);
        expect(problems).toMatch(/screens\[2\] needs a `name`/);
    });

    it('refuses something that is not JSON, or has no screens', () => {
        expect(() => parseManifest('{ screens: [] ')).toThrow(ManifestError);
        expect(() => parseManifest('{"pages": []}')).toThrow(/`screens` list/);
    });
});

describe('touchedScreens and unmatchedPatterns', () => {
    it('names the screens a change reaches, with the files that reach them', () => {
        const touched = touchedScreens(['README.md', 'src/app/[locale]/about/page.tsx'], [ABOUT]);
        expect(touched).toEqual([{ screen: ABOUT, files: ['src/app/[locale]/about/page.tsx'] }]);
    });

    it('leaves a change to an unlisted path alone', () => {
        expect(touchedScreens(['src/app/[locale]/help/page.tsx', 'package.json'], [ABOUT])).toEqual([]);
    });

    it('catches a manifest entry that no longer matches any file', () => {
        expect(unmatchedPatterns([ABOUT], ['src/app/[locale]/about/page.tsx'])).toEqual([]);
        expect(unmatchedPatterns([ABOUT], ['src/app/[locale]/about-us/page.tsx'])).toEqual([
            { screen: 'About', pattern: 'src/app/[locale]/about/**' },
        ]);
    });
});

describe('linkedMobilePulls', () => {
    it('reads full pull request URLs to the mobile repo, in any case, once each', () => {
        const body = `Mobile: ${LINK}\nAlso https://github.com/forhu/Cheapest-Go-Mobile/pull/90/files and ${LINK}#discussion`;
        expect(linkedMobilePulls(body)).toEqual([88, 90]);
    });

    it('does not count an issue, another repo, a placeholder or a shorthand', () => {
        const body = [
            'https://github.com/FORHU/cheapest-go-mobile/issues/60',
            'https://github.com/FORHU/cheapestgo-app-v2/pull/12',
            'https://github.com/FORHU/cheapest-go-mobile/pull/<number>',
            'FORHU/cheapest-go-mobile#88',
            'https://github.com/FORHU/cheapest-go-mobile/pull/12abc',
        ].join('\n');
        expect(linkedMobilePulls(body)).toEqual([]);
    });

    it('ignores a link inside an HTML comment, such as a template example', () => {
        expect(linkedMobilePulls(`<!-- e.g. ${LINK} -->`)).toEqual([]);
        expect(linkedMobilePulls(`text <!-- unterminated ${LINK}`)).toEqual([]);
    });

    it('copes with an empty description', () => {
        expect(linkedMobilePulls(null)).toEqual([]);
        expect(linkedMobilePulls('')).toEqual([]);
    });
});

describe('decide', () => {
    const touched = touchedScreens(['src/app/[locale]/about/page.tsx'], [ABOUT]);

    it('lets an untouched pull request through without asking anything', () => {
        expect(decide([], null, [])).toEqual({ kind: 'untouched' });
    });

    it('blocks a mirrored change with no link and no label', () => {
        expect(decide(touched, 'Tweaks the about hero.', ['enhancement']).kind).toBe('blocked');
    });

    it('passes it with a linked mobile pull request', () => {
        expect(decide(touched, `Mobile: ${LINK}`, [])).toEqual({ kind: 'linked', touched, pulls: [88] });
    });

    it('passes it with the exemption label, in any case', () => {
        expect(decide(touched, null, ['Mobile-Parity-Exempt']).kind).toBe('exempt');
    });

    it('prefers the link when both are present', () => {
        expect(decide(touched, LINK, [EXEMPT_LABEL]).kind).toBe('linked');
    });
});

describe('failureMessage', () => {
    it('names the Flutter screen to update, the file that triggered it, and both ways through', () => {
        const message = failureMessage(touchedScreens(['src/app/[locale]/about/page.tsx'], [ABOUT]));
        expect(message).toContain('About — update lib/features/about/views/about_view.dart in FORHU/cheapest-go-mobile');
        expect(message).toContain('changed here: src/app/[locale]/about/page.tsx');
        expect(message).toContain('https://github.com/FORHU/cheapest-go-mobile/pull/<number>');
        expect(message).toContain(`\`${EXEMPT_LABEL}\``);
        // The example in the message must not satisfy the check if pasted as-is.
        expect(linkedMobilePulls(message)).toEqual([]);
    });
});

describe('annotation', () => {
    it('escapes newlines in the message and commas and colons in the file', () => {
        expect(annotation('error', 'a\nb 100%', 'src/a,b:c.tsx')).toBe(
            '::error file=src/a%2Cb%3Ac.tsx,title=Mobile parity (ADR-0008)::a%0Ab 100%25',
        );
    });
});

describe('run', () => {
    const manifestText = JSON.stringify({ screens: [ABOUT] });

    function gate(overrides: Partial<GateIO> & { body?: string | null; labels?: string[]; changed?: string[] }) {
        const lines: string[] = [];
        const summaries: string[] = [];
        const code = run({
            event: {
                pull_request: {
                    body: overrides.body ?? null,
                    labels: (overrides.labels ?? []).map((name) => ({ name })),
                    base: { sha: 'base' },
                    head: { sha: 'head' },
                },
            },
            manifestText,
            trackedFiles: () => ['src/app/[locale]/about/page.tsx', 'README.md'],
            changedFiles: () => overrides.changed ?? [],
            out: (line) => lines.push(line),
            summary: (markdown) => summaries.push(markdown),
            ...overrides,
        });
        return { code, log: lines.join('\n'), summary: summaries.join('\n') };
    }

    it('fails a pull request touching About, naming the Flutter screen on the changed file', () => {
        const { code, log } = gate({ changed: ['src/app/[locale]/about/page.tsx'] });
        expect(code).toBe(1);
        expect(log).toContain('::error file=src/app/[locale]/about/page.tsx,');
        expect(log).toContain('About is mirrored by lib/features/about/views/about_view.dart');
    });

    it('passes it once the description links the mobile pull request', () => {
        const { code, log } = gate({ changed: ['src/app/[locale]/about/page.tsx'], body: `Mobile: ${LINK}` });
        expect(code).toBe(0);
        expect(log).toContain('::notice');
    });

    it('passes it with the label, and says so as a warning', () => {
        const { code, log } = gate({ changed: ['src/app/[locale]/about/page.tsx'], labels: [EXEMPT_LABEL] });
        expect(code).toBe(0);
        expect(log).toContain('::warning');
        expect(log).toContain('About — update lib/features/about/views/about_view.dart');
    });

    it('passes a pull request that touches no mirrored screen', () => {
        const { code, log } = gate({ changed: ['src/app/[locale]/help/page.tsx'] });
        expect(code).toBe(0);
        expect(log).toBe('No mirrored screen changed.');
    });

    it('fails on a broken manifest, before looking at the change', () => {
        const { code, log } = gate({ manifestText: '{"screens": [{"name": "About"}]}' });
        expect(code).toBe(1);
        expect(log).toContain('::error file=mirrored-screens.json');
    });

    it('fails on a manifest entry that matches no file', () => {
        const { code, log } = gate({ trackedFiles: () => ['README.md'] });
        expect(code).toBe(1);
        expect(log).toContain('match no file');
    });

    it('does nothing outside a pull request', () => {
        const { code } = gate({ event: {} });
        expect(code).toBe(0);
    });
});

describe('the manifest in this repository', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const screens = parseManifest(readFileSync(fileURLToPath(new URL('../mirrored-screens.json', import.meta.url)), 'utf8'));

    it('is valid and mirrors About', () => {
        expect(screens.map((s) => s.name)).toContain('About');
    });

    it('points every entry at files that exist', () => {
        const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
        expect(unmatchedPatterns(screens, tracked)).toEqual([]);
    });
});
