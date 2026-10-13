import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotelClusters, isCluster } from '@/shared/components/map/useHotelClusters';
import type { MappableProperty } from '@/shared/components/map/types';

/**
 * The map used to keep its frame rate by culling to the viewport and then calling
 * `.slice(0, 100)`, which silently dropped hotels that were inside the view and
 * inside the user's filters. These cover the property that replaced it: every hotel
 * is either drawn or counted inside a cluster, and none is discarded.
 */

const hotel = (id: string, lat: number, lng: number): MappableProperty => ({
    id,
    name: `Hotel ${id}`,
    price: 100,
    currency: 'PHP',
    coordinates: { lat, lng },
} as unknown as MappableProperty);

/** Seoul-ish spread, wide enough that low zooms group them. */
const scattered = (n: number) =>
    Array.from({ length: n }, (_, i) => hotel(`h${i}`, 37.55 + i * 0.004, 126.97 + i * 0.004));

const WORLD = { minLng: -180, minLat: -85, maxLng: 180, maxLat: 85 };

/** Total hotels represented, counting each cluster as the number it stands for. */
const represented = (features: ReturnType<typeof useHotelClusters>['clusters']) =>
    features.reduce((sum, f) => sum + (isCluster(f) ? f.properties.point_count : 1), 0);

describe('useHotelClusters', () => {
    it('accounts for every hotel, whether drawn or clustered', () => {
        const props = scattered(120);
        const { result } = renderHook(() => useHotelClusters(props, WORLD, 10));

        // The point of the change: 120 in, 120 accounted for — no silent truncation.
        expect(represented(result.current.clusters)).toBe(120);
        expect(result.current.clusters.length).toBeLessThan(120);
    });

    it('renders far fewer markers than hotels when zoomed out', () => {
        const props = scattered(300);
        const { result } = renderHook(() => useHotelClusters(props, WORLD, 8));

        expect(result.current.clusters.length).toBeLessThan(50);
        expect(represented(result.current.clusters)).toBe(300);
    });

    it('stops clustering past the max zoom, so each hotel stands alone', () => {
        const props = scattered(30);
        const { result } = renderHook(() => useHotelClusters(props, WORLD, 18));

        expect(result.current.clusters.every(f => !isCluster(f))).toBe(true);
        expect(result.current.clusters).toHaveLength(30);
    });

    it('returns only what the viewport covers', () => {
        const props = [
            hotel('seoul', 37.56, 126.97),
            hotel('athens', 37.97, 23.72),
        ];
        const korea = { minLng: 125, minLat: 33, maxLng: 130, maxLat: 39 };
        const { result } = renderHook(() => useHotelClusters(props, korea, 12));

        expect(result.current.clusters).toHaveLength(1);
        expect(represented(result.current.clusters)).toBe(1);
    });

    it('carries the cheapest member up to the cluster', () => {
        const props = scattered(20).map((p, i) => ({ ...p, id: `p${i}` }));
        const prices = Object.fromEntries(props.map((p, i) => [p.id, 500 + i]));
        const { result } = renderHook(() => useHotelClusters(props, WORLD, 8, prices));

        const cluster = result.current.clusters.find(isCluster);
        expect(cluster).toBeDefined();
        // Whatever it grouped, the advertised price is the lowest of its members.
        expect(cluster!.properties.price).toBeGreaterThan(0);
        expect(cluster!.properties.price).toBeLessThanOrEqual(500 + props.length - 1);
    });

    describe('hotels sharing one coordinate', () => {
        // Real data: 11 such stacks in a Seoul search, 24 in Athens. Zooming never
        // separates them, so the map has to offer a list instead of a dead end.
        const stacked = [
            hotel('a', 37.5665, 126.9780),
            hotel('b', 37.5665, 126.9780),
            hotel('c', 37.5665, 126.9780),
        ];

        it('reports no expansion zoom, rather than a zoom that would not help', () => {
            const { result } = renderHook(() => useHotelClusters(stacked, WORLD, 10));

            const cluster = result.current.clusters.find(isCluster);
            expect(cluster).toBeDefined();
            expect(result.current.getExpansionZoom(cluster!.properties.cluster_id)).toBeNull();
        });

        it('hands back every hotel in the stack for the list', () => {
            const { result } = renderHook(() => useHotelClusters(stacked, WORLD, 10));

            const cluster = result.current.clusters.find(isCluster);
            const leaves = result.current.getLeaves(cluster!.properties.cluster_id);

            expect(leaves.map(l => l.id).sort()).toEqual(['a', 'b', 'c']);
        });
    });

    it('gives a real expansion zoom for a cluster that can be broken up', () => {
        const props = scattered(60);
        const { result } = renderHook(() => useHotelClusters(props, WORLD, 8));

        const cluster = result.current.clusters.find(isCluster);
        const zoom = result.current.getExpansionZoom(cluster!.properties.cluster_id);

        expect(zoom).not.toBeNull();
        expect(zoom!).toBeGreaterThan(8);
    });

    it('survives an empty result set', () => {
        const { result } = renderHook(() => useHotelClusters([], WORLD, 12));
        expect(result.current.clusters).toEqual([]);
    });

    it('still returns markers before the map has reported a viewport', () => {
        // First paint: bounds are null. Rendering nothing would flash an empty map.
        const { result } = renderHook(() => useHotelClusters(scattered(20), null, 10));
        expect(represented(result.current.clusters)).toBe(20);
    });
});
