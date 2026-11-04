import { GOLF_EXTRAS, type GolfExtraChoice, type GolfExtraCode } from '@/features/golf/types';

/** English names and units, for the back office: a staff screen, so not translated. */
export const EXTRA_NAMES_EN: Record<GolfExtraCode, string> = {
    club_rental: 'Club rental', caddie: 'Caddie', cart: 'Golf cart', lessons: 'Golf lesson', range_balls: 'Bucket of range balls',
};
export const EXTRA_UNITS_EN: Record<GolfExtraCode, string> = {
    club_rental: 'per set', caddie: 'per caddie', cart: 'per cart', lessons: 'per lesson', range_balls: 'per bucket',
};

const isExtra = (code: string): code is GolfExtraCode => (GOLF_EXTRAS as readonly string[]).includes(code);
const byListOrder = (a: GolfExtraChoice, b: GolfExtraChoice) => GOLF_EXTRAS.indexOf(a.code) - GOLF_EXTRAS.indexOf(b.code);

/** `club_rental:2,cart:1`, from the checkout's address. What cannot be read is dropped; api-v2 prices the rest. */
export function parseExtrasParam(value: string | undefined): GolfExtraChoice[] {
    if (!value) return [];
    const seen = new Set<string>();
    const out: GolfExtraChoice[] = [];
    for (const part of value.split(',')) {
        const [code, count] = part.split(':');
        const quantity = Number(count);
        if (!isExtra(code) || seen.has(code) || !Number.isInteger(quantity) || quantity < 1) continue;
        seen.add(code);
        out.push({ code, quantity });
    }
    return out.sort(byListOrder);
}

/** The reverse of `parseExtrasParam`. In list order, so the same choices are always the same string. */
export function formatExtrasParam(choices: GolfExtraChoice[]): string {
    return [...choices].sort(byListOrder).map((c) => `${c.code}:${c.quantity}`).join(',');
}

/** What the course asks for these lines, in its own currency: the figure the team quotes to it. */
export const extrasCourseTotal = (lines: Array<{ quantity: number; unitPrice: number }>): number =>
    lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
