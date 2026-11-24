/**
 * The mirrored-screens gate — docs/adr/0008, issue #32.
 *
 * A pull request that changes a screen the Flutter app mirrors is not done until mobile matches.
 * `mirrored-screens.json` lists those screens. This fails a pull request that touches one unless
 * its description links a cheapest-go-mobile pull request or it carries the exemption label.
 *
 * Run by .github/workflows/mirrored-screens.yml as `node scripts/mirrored-screens.ts`: Node 24
 * runs TypeScript as written, so there is nothing to build and nothing to install. That is also
 * why only erasable syntax is used here — no enums, no parameter properties. `scripts/package.json`
 * declares the folder ESM; without it Node guesses, warns, and parses the file twice.
 *
 * Every decision is a pure function, tested in mirrored-screens.test.ts. `main` only gathers what
 * they need: the event GitHub hands the job, the manifest, and two git commands.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_PATH = 'mirrored-screens.json';
export const MOBILE_REPO = 'FORHU/cheapest-go-mobile';
export const EXEMPT_LABEL = 'mobile-parity-exempt';
const ADR = 'docs/adr/0008-a-ui-change-here-is-not-done-until-mobile-matches.md';
const CHECK = 'Mobile parity (ADR-0008)';

export interface MirroredScreen {
    /** What the failure message calls the screen. */
    name: string;
    /** Patterns for this repository's files that make up the screen. */
    v2: string[];
    /** The files in cheapest-go-mobile that have to change with it. */
    flutter: string[];
}

// ── The manifest ─────────────────────────────────────────────────────────────

export class ManifestError extends Error {
    problems: string[];

    constructor(problems: string[]) {
        super(`${MANIFEST_PATH} is not valid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
        this.name = 'ManifestError';
        this.problems = problems;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Why a path cannot be used, or null when it can. Shared by both sides of an entry. */
function pathProblem(value: string): string | null {
    if (value.trim() === '') return 'is empty';
    if (value.includes('\\')) return 'uses a backslash — paths use forward slashes';
    if (value.startsWith('/') || value.startsWith('./')) return 'starts with / or ./ — write it from the repository root';
    if (value.endsWith('/')) return 'ends with / — end a folder with /** to mean everything inside it';
    if (value.split('/').some((s) => s === '' || s === '.' || s === '..')) return 'has an empty, . or .. folder';
    return null;
}

function stringList(value: unknown, where: string, problems: string[]): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        problems.push(`${where} needs at least one path`);
        return [];
    }
    const out: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string') {
            problems.push(`${where} has an entry that is not a string`);
            continue;
        }
        const why = pathProblem(item);
        if (why) problems.push(`${where} "${item}" ${why}`);
        else out.push(item);
    }
    return out;
}

/**
 * The manifest's screens, or a ManifestError listing every problem at once — one red run should
 * say everything that needs fixing, not reveal the next problem after the last is fixed.
 */
export function parseManifest(text: string): MirroredScreen[] {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (error) {
        throw new ManifestError([`it is not valid JSON (${(error as Error).message})`]);
    }
    if (!isRecord(raw) || !Array.isArray(raw.screens)) {
        throw new ManifestError(['it needs a top-level `screens` list']);
    }

    const problems: string[] = [];
    for (const key of Object.keys(raw)) {
        // `_comment` and anything else starting with _ is for people.
        if (key !== 'screens' && !key.startsWith('_')) problems.push(`unknown top-level key \`${key}\``);
    }

    const screens: MirroredScreen[] = [];
    const seen = new Set<string>();
    raw.screens.forEach((entry: unknown, index: number) => {
        const where = `screens[${index}]`;
        if (!isRecord(entry)) {
            problems.push(`${where} is not an object`);
            return;
        }
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        const label = name ? `"${name}"` : where;
        if (!name) problems.push(`${where} needs a \`name\` — the failure message uses it to say which screen to update`);
        else if (seen.has(name.toLowerCase())) problems.push(`${label} is listed twice`);
        seen.add(name.toLowerCase());

        for (const key of Object.keys(entry)) {
            if (key !== 'name' && key !== 'v2' && key !== 'flutter') problems.push(`${label} has an unknown key \`${key}\``);
        }

        screens.push({
            name,
            v2: stringList(entry.v2, `${label}.v2`, problems),
            flutter: stringList(entry.flutter, `${label}.flutter`, problems),
        });
    });

    if (problems.length > 0) throw new ManifestError(problems);
    return screens;
}

// ── Matching ─────────────────────────────────────────────────────────────────

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `*` within one folder, `**` across any number of them, everything else literal.
 *
 * Deliberately not a glob library. In glob syntax `[locale]` is a character class matching one
 * letter, so `src/app/[locale]/about/**` would quietly match nothing in a Next.js app and the
 * gate would pass every pull request while looking like it worked.
 */
function patternToRegExp(pattern: string): RegExp {
    const segments = pattern.split('/');
    let source = '';
    segments.forEach((segment, index) => {
        const last = index === segments.length - 1;
        if (segment === '**') {
            source += last ? '.+' : '(?:[^/]+/)*';
            return;
        }
        source += segment.split('*').map(escapeRegExp).join('[^/]*');
        if (!last) source += '/';
    });
    return new RegExp(`^${source}$`);
}

const compiled = new Map<string, RegExp>();

export function matchesPattern(file: string, pattern: string): boolean {
    let re = compiled.get(pattern);
    if (!re) {
        re = patternToRegExp(pattern);
        compiled.set(pattern, re);
    }
    return re.test(file);
}

export interface Touch {
    screen: MirroredScreen;
    /** This pull request's files that belong to the screen. */
    files: string[];
}

/** The mirrored screens a set of changed files reaches, each with the files that reach it. */
export function touchedScreens(changed: readonly string[], screens: readonly MirroredScreen[]): Touch[] {
    return screens
        .map((screen) => ({ screen, files: changed.filter((file) => screen.v2.some((p) => matchesPattern(file, p))) }))
        .filter((touch) => touch.files.length > 0);
}

/**
 * Patterns that match no file in the repository.
 *
 * A screen that moves would otherwise leave its entry guarding an empty path, and the gate would
 * go quiet while the manifest still claims the screen is mirrored.
 */
export function unmatchedPatterns(screens: readonly MirroredScreen[], tracked: readonly string[]): { screen: string; pattern: string }[] {
    const out: { screen: string; pattern: string }[] = [];
    for (const screen of screens) {
        for (const pattern of screen.v2) {
            if (!tracked.some((file) => matchesPattern(file, pattern))) out.push({ screen: screen.name, pattern });
        }
    }
    return out;
}

// ── Linking ──────────────────────────────────────────────────────────────────

const MOBILE_PULL = new RegExp(String.raw`https?://(?:www\.)?github\.com/${escapeRegExp(MOBILE_REPO)}/pull/(\d+)\b`, 'gi');

/**
 * The cheapest-go-mobile pull requests a description links to, by number.
 *
 * Only the full URL counts. `FORHU/cheapest-go-mobile#12` reads the same whether 12 is an issue or
 * a pull request, and linking the mobile *issue* is the likeliest way to get this wrong.
 *
 * HTML comments are skipped, so an example inside a pull request template cannot satisfy it.
 */
export function linkedMobilePulls(body: string | null | undefined): number[] {
    if (!body) return [];
    const visible = body.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
    const numbers = new Set<number>();
    for (const match of visible.matchAll(MOBILE_PULL)) numbers.add(Number(match[1]));
    return [...numbers].sort((a, b) => a - b);
}

// ── The decision ─────────────────────────────────────────────────────────────

export type Verdict =
    | { kind: 'untouched' }
    | { kind: 'linked'; touched: Touch[]; pulls: number[] }
    | { kind: 'exempt'; touched: Touch[] }
    | { kind: 'blocked'; touched: Touch[] };

export function decide(touched: Touch[], body: string | null | undefined, labels: readonly string[]): Verdict {
    if (touched.length === 0) return { kind: 'untouched' };
    const pulls = linkedMobilePulls(body);
    if (pulls.length > 0) return { kind: 'linked', touched, pulls };
    // Label names are case-insensitive on GitHub.
    if (labels.some((label) => label.toLowerCase() === EXEMPT_LABEL)) return { kind: 'exempt', touched };
    return { kind: 'blocked', touched };
}

function screenLines(touched: readonly Touch[]): string[] {
    const lines: string[] = [];
    for (const { screen, files } of touched) {
        lines.push(`  ${screen.name} — update ${screen.flutter.join(', ')} in ${MOBILE_REPO}`);
        for (const file of files) lines.push(`      changed here: ${file}`);
    }
    return lines;
}

/** What a blocked pull request is told. Names the Flutter screen to update, and the two ways through. */
export function failureMessage(touched: readonly Touch[]): string {
    return [
        `This pull request changes ${touched.length === 1 ? 'a screen' : 'screens'} the Flutter app mirrors, so it is not done until mobile matches (${ADR}).`,
        '',
        ...screenLines(touched),
        '',
        'Either:',
        "  • link the mobile pull request in this pull request's description, as a full URL:",
        `        https://github.com/${MOBILE_REPO}/pull/<number>`,
        '    It has to exist, not to be merged: see "Order of merging" in the ADR.',
        `  • or add the \`${EXEMPT_LABEL}\` label, if the change does not reach what the screen shows or does.`,
        '    An exemption is a recorded decision to let the two diverge.',
        '',
        'Editing the description or the labels runs this check again; no new commit is needed.',
    ].join('\n');
}

// ── Running it ───────────────────────────────────────────────────────────────

/** The parts of a `pull_request` event this reads. */
export interface PullRequestEvent {
    pull_request?: {
        body?: string | null;
        labels?: { name?: string }[];
        base?: { sha?: string };
        head?: { sha?: string };
    };
}

export interface GateIO {
    event: PullRequestEvent;
    manifestText: string;
    trackedFiles: () => string[];
    changedFiles: (base: string, head: string) => string[];
    out: (line: string) => void;
    summary: (markdown: string) => void;
}

/** A GitHub workflow command, escaped so a message can span lines and a path can hold a comma. */
export function annotation(level: 'error' | 'warning' | 'notice', message: string, file?: string): string {
    const data = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    const prop = (s: string) => data(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
    const props = [file ? `file=${prop(file)}` : null, `title=${prop(CHECK)}`].filter(Boolean).join(',');
    return `::${level} ${props}::${data(message)}`;
}

const fenced = (text: string) => `\`\`\`text\n${text}\n\`\`\``;

/** The whole check, given its inputs. Returns the exit code. */
export function run(io: GateIO): number {
    const pr = io.event.pull_request;
    if (!pr) {
        io.out('Not a pull request; nothing to check.');
        return 0;
    }

    let screens: MirroredScreen[];
    try {
        screens = parseManifest(io.manifestText);
    } catch (error) {
        if (!(error instanceof ManifestError)) throw error;
        io.out(annotation('error', error.message, MANIFEST_PATH));
        io.summary(`### ${CHECK}\n\n${fenced(error.message)}`);
        return 1;
    }

    const stale = unmatchedPatterns(screens, io.trackedFiles());
    if (stale.length > 0) {
        const message = [
            `${MANIFEST_PATH} lists paths that match no file, so they guard nothing:`,
            ...stale.map((s) => `  - ${s.screen}: ${s.pattern}`),
            'If the screen moved, point its entry at the new path. If it is gone, remove the entry.',
        ].join('\n');
        io.out(annotation('error', message, MANIFEST_PATH));
        io.summary(`### ${CHECK}\n\n${fenced(message)}`);
        return 1;
    }

    const base = pr.base?.sha;
    const head = pr.head?.sha;
    if (!base || !head) {
        io.out(annotation('error', 'The event names no base or head commit, so there is nothing to compare.'));
        return 1;
    }

    const touched = touchedScreens(io.changedFiles(base, head), screens);
    const labels = (pr.labels ?? []).map((l) => l.name ?? '').filter(Boolean);
    const verdict = decide(touched, pr.body, labels);

    switch (verdict.kind) {
        case 'untouched':
            io.out('No mirrored screen changed.');
            io.summary(`### ${CHECK}\n\nNo mirrored screen changed.`);
            return 0;

        case 'linked': {
            const links = verdict.pulls.map((n) => `https://github.com/${MOBILE_REPO}/pull/${n}`);
            const names = verdict.touched.map((t) => t.screen.name).join(', ');
            io.out(annotation('notice', `${names}: mobile pull request linked — ${links.join(', ')}`));
            io.summary(`### ${CHECK}\n\nChanges ${names}. Mobile: ${links.join(', ')}`);
            return 0;
        }

        case 'exempt': {
            // Passes, loudly: an exemption is a decision to let the two diverge, and the ADR
            // needs those to stay visible rather than pile up unseen.
            const message = [
                `Exempt by the \`${EXEMPT_LABEL}\` label. Mobile will differ from this until someone brings it back:`,
                ...screenLines(verdict.touched),
            ].join('\n');
            io.out(annotation('warning', message));
            io.summary(`### ${CHECK}\n\n${fenced(message)}`);
            return 0;
        }

        case 'blocked': {
            const message = failureMessage(verdict.touched);
            io.out(message);
            io.out(annotation('error', message));
            // On the changed lines themselves, so the Files tab says it too.
            for (const { screen, files } of verdict.touched) {
                for (const file of files) {
                    io.out(annotation('error', `${screen.name} is mirrored by ${screen.flutter.join(', ')} in ${MOBILE_REPO}. Link the mobile pull request in the description, or add the ${EXEMPT_LABEL} label.`, file));
                }
            }
            io.summary(`### ${CHECK}\n\n${fenced(message)}`);
            return 1;
        }
    }
}

function main(): number {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const git = (args: string[]) =>
        execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            .split('\0')
            .filter(Boolean);
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;

    try {
        return run({
            event: eventPath ? (JSON.parse(readFileSync(eventPath, 'utf8')) as PullRequestEvent) : {},
            manifestText: readFileSync(path.join(root, MANIFEST_PATH), 'utf8'),
            trackedFiles: () => git(['ls-files', '-z']),
            // Three dots: what this branch changed since it left the base, which is what it
            // touches. --no-renames so moving a screen's file away counts as touching it.
            changedFiles: (base, head) => git(['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`]),
            out: (line) => console.log(line),
            summary: (markdown) => {
                if (summaryPath) appendFileSync(summaryPath, `${markdown}\n`);
            },
        });
    } catch (error) {
        console.log(annotation('error', `The check could not run: ${(error as Error).message}`));
        return 1;
    }
}

// Run only when executed, not when the tests import it. Case-insensitive on Windows, where the
// drive letter can arrive as c: or C: depending on who typed the path.
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? entry.toLowerCase() === self.toLowerCase() : entry === self) {
    process.exitCode = main();
}
