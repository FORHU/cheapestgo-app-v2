import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HotelPin } from '../HotelPin';

/**
 * Which picture a map pin asks for.
 *
 * A pin draws its photo at 28px, and the catalog stores ETG photos at 1024x768. Fetched at
 * that size, the pins on one Seoul viewport cost 6.3 MB before the map looked finished, and
 * every zoom that brought new pins cost as much again. The pin asks ETG's CDN for the small
 * size instead — and must still show a photo when that size is missing, and must leave a
 * picture from any other host exactly as it was.
 */

const ETG = 'https://cdn.worldota.net/t/1024x768/content/28/zz/28ad98d5315586cd2acac92fe4cd1d1091da95b4.JPEG';
const photoOf = (container: HTMLElement) => container.querySelector('img') as HTMLImageElement;

describe('HotelPin photo', () => {
    it('asks ETG for the thumbnail size, not the card size', () => {
        const { container } = render(<HotelPin image={ETG} priceLabel="₩90,000" />);

        expect(photoOf(container).getAttribute('src'))
            .toBe('https://cdn.worldota.net/t/120x120/content/28/zz/28ad98d5315586cd2acac92fe4cd1d1091da95b4.JPEG');
    });

    it('falls back to the stored size when the thumbnail fails, then stops', () => {
        const { container } = render(<HotelPin image={ETG} priceLabel="₩90,000" />);
        const img = photoOf(container);

        fireEvent.error(img);
        expect(img.getAttribute('src')).toBe(ETG);
        expect(img.style.display).not.toBe('none');

        fireEvent.error(img);
        expect(img.style.display).toBe('none');
    });

    it('leaves a photo from any other host untouched, and does not retry it', () => {
        const own = '/api/v2/photos/hotel/123';
        const { container } = render(<HotelPin image={own} priceLabel="₩90,000" />);
        const img = photoOf(container);

        expect(img.getAttribute('src')).toBe(own);
        fireEvent.error(img);
        expect(img.style.display).toBe('none');
    });
});
