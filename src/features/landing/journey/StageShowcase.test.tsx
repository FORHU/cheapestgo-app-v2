import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageShowcase } from './StageShowcase';
import { STAGES, faceOf } from './stages';

/** Mid-way through the search stage's dock, where its backdrop is fully shown. */
const SEARCH_DOCKED = STAGES[0].from + (STAGES[0].to - STAGES[0].from) * 0.25;

describe('StageShowcase', () => {
    it('shows a face\'s own ground in place of a photograph that will not load', () => {
        const golf = faceOf(STAGES[0], 'golf');
        const { container } = render(<StageShowcase journey={SEARCH_DOCKED} mode="golf" reducedMotion={false} />);

        const photo = container.querySelector<HTMLImageElement>('img[src*="golf-dusk.webp"]');
        expect(photo).not.toBeNull();
        expect(screen.queryByTestId('ground-golf')).toBeNull();

        fireEvent.error(photo!);

        expect(container.querySelector('img[src*="golf-dusk.webp"]')).toBeNull();
        expect(screen.getByTestId('ground-golf').style.background).toContain('linear-gradient');
        expect(golf.ground).toContain('#14532d');
    });

    it('leaves a photograph that loads exactly as it was', () => {
        const { container } = render(<StageShowcase journey={SEARCH_DOCKED} mode="flights" reducedMotion={false} />);
        const photo = container.querySelector<HTMLImageElement>('img[src*="airport-dusk.webp"]');
        fireEvent.load(photo!);
        expect(container.querySelector('img[src*="airport-dusk.webp"]')).not.toBeNull();
        expect(screen.queryByTestId('ground-flights')).toBeNull();
    });
});
