export type StreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
export type ViewMode = 'map' | 'list';
export type SortValue = 'recommended' | 'price-low' | 'price-high' | 'rating' | 'most-reviewed';

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
    { value: 'recommended',   label: 'Recommended' },
    { value: 'price-low',     label: 'Cheapest first' },
    { value: 'rating',        label: 'Top Rated' },
    { value: 'most-reviewed', label: 'Most Reviewed' },
    { value: 'price-high',    label: 'Price: High to Low' },
];

export const SEARCH_TOKENS = {
    ACCENT:      '#FF6B4B',
    TEXT:        '#F5EFE4',
    BG:          '#15111E',
    BORDER:      'rgba(255,255,255,0.08)',
    DIM:         'rgba(245,239,228,0.45)',
    OVERLAY_BG:  'rgba(28,23,36,0.82)',
    OVERLAY_BDR: 'rgba(255,255,255,0.15)',
} as const;
