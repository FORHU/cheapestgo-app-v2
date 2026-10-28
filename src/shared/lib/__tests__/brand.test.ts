import { describe, expect, it } from 'vitest';
import {
    canonicalBrandName,
    brandWordmark,
    brandPreviewEnabled,
    parsePreviewBrand,
    brandFromHost,
    resolveBrandName,
    brandProfile,
} from '../brand';

describe('brand name', () => {
    it('shows the new name while the deployment still says the old one', () => {
        // The whole point of the mapping. The Korean instance keeps running with
        // NEXT_PUBLIC_BRAND_NAME=GeomeeGo until it is rebuilt, and the UI must already
        // read AirangGo — that is what "rename the UI ahead of deployment" means here.
        expect(canonicalBrandName('GeomeeGo')).toBe('AirangGo');
        expect(canonicalBrandName('AirangGo')).toBe('AirangGo');
    });

    it('leaves brands that were never renamed alone', () => {
        expect(canonicalBrandName('CheapestGo')).toBe('CheapestGo');
        expect(canonicalBrandName('SomeOtherBrand')).toBe('SomeOtherBrand');
    });

    it('falls back to CheapestGo when nothing is configured', () => {
        expect(canonicalBrandName(undefined)).toBe('CheapestGo');
        expect(canonicalBrandName('')).toBe('CheapestGo');
        expect(canonicalBrandName('   ')).toBe('CheapestGo');
    });

    it('splits the wordmark so the trailing Go can be accented', () => {
        expect(brandWordmark('CheapestGo')).toEqual({ head: 'Cheapest', tail: 'Go' });
        expect(brandWordmark('AirangGo')).toEqual({ head: 'Airang', tail: 'Go' });
    });

    it('spells the Korean brand correctly from the old name', () => {
        // The admin sidebar rendered "GeomeGo" — one e short — because the split was
        // written out by hand in five places. Derived from the name, that cannot recur.
        expect(brandWordmark('GeomeeGo')).toEqual({ head: 'Airang', tail: 'Go' });
    });

    it('does not mangle a brand that does not end in Go', () => {
        expect(brandWordmark('Wanderlust')).toEqual({ head: 'Wanderlust', tail: '' });
        // "Go" alone is the whole name, not a head of nothing plus an accent.
        expect(brandWordmark('Go')).toEqual({ head: 'Go', tail: '' });
    });
});

/**
 * A single unfinished deployment can show either brand — but only where a visitor choosing the
 * brand is harmless. On production the brand is the one the build was made for (ADR-0005), so
 * every guard below is about *not* switching, as much as about switching.
 */
describe('brand preview gate', () => {
    it('is off unless asked for', () => {
        expect(brandPreviewEnabled({})).toBe(false);
        expect(brandPreviewEnabled({ NODE_ENV: 'production' })).toBe(false);
        expect(brandPreviewEnabled({ NODE_ENV: 'test' })).toBe(false);
    });

    it('is on when the deployment opts in', () => {
        expect(brandPreviewEnabled({ NODE_ENV: 'production', BRAND_PREVIEW: '1' })).toBe(true);
        expect(brandPreviewEnabled({ NODE_ENV: 'production', BRAND_PREVIEW: 'true' })).toBe(true);
    });

    it('does not read any other value as an opt-in', () => {
        // "0" and "false" are truthy strings; a flag that treated them as on would switch the
        // brand on a deployment whose owner had written the opposite.
        expect(brandPreviewEnabled({ NODE_ENV: 'production', BRAND_PREVIEW: '0' })).toBe(false);
        expect(brandPreviewEnabled({ NODE_ENV: 'production', BRAND_PREVIEW: 'false' })).toBe(false);
        expect(brandPreviewEnabled({ NODE_ENV: 'production', BRAND_PREVIEW: '' })).toBe(false);
    });

    it('is on for a local dev server, so a brand needs no rebuild to be seen', () => {
        expect(brandPreviewEnabled({ NODE_ENV: 'development' })).toBe(true);
    });
});

describe('parsePreviewBrand', () => {
    it('accepts the two brands, in the spelling a link or cookie would carry', () => {
        expect(parsePreviewBrand('airanggo')).toBe('AirangGo');
        expect(parsePreviewBrand('AirangGo')).toBe('AirangGo');
        expect(parsePreviewBrand('cheapestgo')).toBe('CheapestGo');
        expect(parsePreviewBrand('  CHEAPESTGO ')).toBe('CheapestGo');
    });

    it('reads the pre-rebrand name as the current one', () => {
        expect(parsePreviewBrand('GeomeeGo')).toBe('AirangGo');
        expect(parsePreviewBrand('geomeego')).toBe('AirangGo');
    });

    it('refuses anything that is not one of them', () => {
        // The picked value is printed into titles, copy and the privacy policy. A free string
        // here would let a crafted link put its own words in the policy that says who collects
        // the reader's data.
        expect(parsePreviewBrand('Wanderlust')).toBeNull();
        expect(parsePreviewBrand('<script>alert(1)</script>')).toBeNull();
        expect(parsePreviewBrand('AirangGo<b>')).toBeNull();
        expect(parsePreviewBrand('')).toBeNull();
        expect(parsePreviewBrand('   ')).toBeNull();
        expect(parsePreviewBrand(undefined)).toBeNull();
        expect(parsePreviewBrand(null)).toBeNull();
    });
});

describe('brandFromHost', () => {
    it('names the brand whose domain the host is on', () => {
        expect(brandFromHost('airanggo.com')).toBe('AirangGo');
        expect(brandFromHost('v2.airanggo.com')).toBe('AirangGo');
        expect(brandFromHost('v2.airanggo.com:3000')).toBe('AirangGo');
        expect(brandFromHost('cheapestgo.com')).toBe('CheapestGo');
        expect(brandFromHost('www.cheapestgo.com')).toBe('CheapestGo');
        // geomeego.com keeps resolving until DNS moves (ADR-0005 amendment).
        expect(brandFromHost('geomeego.com')).toBe('AirangGo');
    });

    it('says nothing for a host that merely contains the name', () => {
        // A Vercel project called "cheapestgo-app-v2" must not override a build made for AirangGo.
        expect(brandFromHost('cheapestgo-app-v2-git-feat-team.vercel.app')).toBeNull();
        expect(brandFromHost('localhost:3002')).toBeNull();
        expect(brandFromHost('notairanggo.com')).toBeNull();
        expect(brandFromHost('airanggo.com.evil.test')).toBeNull();
        expect(brandFromHost('')).toBeNull();
        expect(brandFromHost(undefined)).toBeNull();
    });
});

describe('resolveBrandName', () => {
    it('is the deployment’s own brand when the preview is off, whatever is asked', () => {
        expect(resolveBrandName({ deployment: 'CheapestGo', enabled: false, cookie: 'airanggo', host: 'airanggo.com' }))
            .toBe('CheapestGo');
        expect(resolveBrandName({ deployment: 'AirangGo', enabled: false, cookie: 'cheapestgo', host: 'cheapestgo.com' }))
            .toBe('AirangGo');
    });

    it('canonicalises the deployment’s brand when it is the answer', () => {
        expect(resolveBrandName({ deployment: 'GeomeeGo', enabled: false })).toBe('AirangGo');
        expect(resolveBrandName({ deployment: undefined, enabled: true })).toBe('CheapestGo');
    });

    it('prefers what the visitor picked, then the host, then the build', () => {
        expect(resolveBrandName({ deployment: 'CheapestGo', enabled: true, cookie: 'airanggo', host: 'cheapestgo.com' }))
            .toBe('AirangGo');
        expect(resolveBrandName({ deployment: 'CheapestGo', enabled: true, host: 'v2.airanggo.com' }))
            .toBe('AirangGo');
        expect(resolveBrandName({ deployment: 'AirangGo', enabled: true, host: 'x.vercel.app' }))
            .toBe('AirangGo');
    });

    it('ignores a cookie that is not a brand and falls through', () => {
        expect(resolveBrandName({ deployment: 'CheapestGo', enabled: true, cookie: 'nonsense', host: 'airanggo.com' }))
            .toBe('AirangGo');
        expect(resolveBrandName({ deployment: 'AirangGo', enabled: true, cookie: 'nonsense' }))
            .toBe('AirangGo');
    });
});

describe('brandProfile', () => {
    it('gives AirangGo its own origin, favicon and share logo', () => {
        const profile = brandProfile('AirangGo');
        expect(profile.origin).toBe('https://airanggo.com');
        expect(profile.favicon).toBe('/Airang_Fav.png');
        expect(profile.logo).toBe('/Airanggo_transparent.png');
    });

    it('follows the rename, so a deployment still started as GeomeeGo is not left on CheapestGo art', () => {
        expect(brandProfile('GeomeeGo')).toEqual(brandProfile('AirangGo'));
    });

    it('keeps CheapestGo’s existing assets', () => {
        const profile = brandProfile('CheapestGo');
        expect(profile.origin).toBe('https://cheapestgo.com');
        expect(profile.favicon).toBe('/Fav_Icon_Light.png');
        expect(profile.logo).toBe('/Web_Logo_Light.png');
        expect(profile.icon).toBe('/icon-192.png');
    });

    it('falls back to CheapestGo’s for a brand with no art of its own', () => {
        expect(brandProfile('Wanderlust')).toEqual(brandProfile('CheapestGo'));
        expect(brandProfile(undefined)).toEqual(brandProfile('CheapestGo'));
    });
});
