import { useMemo } from 'react';
import Supercluster from 'supercluster';
import type { MappableProperty } from '@/shared/components/map/types';

/**
 * Group hotel markers so the map renders a bounded number of them at any zoom.
 *
 * A city search hands the map every hotel it found — around 1,100 distinct
 * coordinates for Seoul, 966 for Athens — and one HTML `<Marker>` per hotel is the
 * dominant cost of panning, because Mapbox re-transforms every marker node each
 * frame. The map used to cope by culling to the viewport and then truncating with
 * `.slice(0, 100)`, which kept the frame rate but silently dropped hotels that were
 * inside the view and inside the user's filters. Clustering replaces the truncation:
 * nothing is discarded, it is folded into a cluster that says how many it stands for.
 *
 * Supercluster indexes every property once and answers `getClusters(bbox, zoom)`, so
 * the viewport query and the aggregation are the same operation — the map only ever
 * materialises markers for what is actually on screen.
 */

/** What a cluster or a lone hotel carries once supercluster has indexed it. */
export interface ClusterPointProps {
    propertyId: string;
    /** Converted display price, so a cluster can advertise its cheapest member. */
    price: number;
}

export type HotelClusterFeature = Supercluster.PointFeature<ClusterPointProps>;
export type HotelCluster = Supercluster.ClusterFeature<ClusterPointProps>;
export type ClusterOrPoint = HotelCluster | HotelClusterFeature;

export interface ViewBounds {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
}

export function isCluster(f: ClusterOrPoint): f is HotelCluster {
    return !!(f.properties as Supercluster.ClusterProperties).cluster;
}

/**
 * `radius` is in pixels at the given zoom, and it is really a marker-count dial.
 * Measured against captured Seoul (1,113 hotels) and Athens (996) results, in a
 * 1200px map column, the busiest viewport mounts:
 *
 *     radius 60  ->  137 markers      radius 80  ->  102      radius 100  ->  87
 *
 * 80 is the choice: it holds the peak at roughly the DOM budget the old hard cap of
 * 100 was picked for, except nothing is hidden to get there. The library default of
 * 40 is far too loose for us — these are wide price pills, not dots, so markers 40px
 * apart still overlap and read as a jumble. 100 goes the other way and folds pills
 * that are plainly distinct on screen.
 *
 * `maxZoom` is the zoom past which nothing is clustered any more. 16 puts individual
 * hotels on screen at street level while still folding a dense block at district
 * level. Above it every hotel stands alone.
 */
const CLUSTER_RADIUS = 80;
const CLUSTER_MAX_ZOOM = 16;

export interface UseHotelClustersResult {
    /** Clusters and lone hotels for the current viewport, ready to render. */
    clusters: ClusterOrPoint[];
    /**
     * The zoom at which this cluster breaks apart, or null when it never will —
     * every hotel in it shares one coordinate, so no amount of zooming separates
     * them and the caller should show a list instead.
     */
    getExpansionZoom: (clusterId: number) => number | null;
    /** Every hotel a cluster stands for, for that list. */
    getLeaves: (clusterId: number) => MappableProperty[];
}

export function useHotelClusters(
    properties: MappableProperty[],
    bounds: ViewBounds | null,
    zoom: number,
    prices: Record<string, number> = {},
): UseHotelClustersResult {
    const byId = useMemo(() => {
        const map: Record<string, MappableProperty> = {};
        for (const p of properties) map[p.id] = p;
        return map;
    }, [properties]);

    const index = useMemo(() => {
        const sc = new Supercluster<ClusterPointProps>({
            radius:  CLUSTER_RADIUS,
            maxZoom: CLUSTER_MAX_ZOOM,
            // Carry the cheapest member upward so a cluster pill can show "from ₱X"
            // without us reaching back into the leaves on every render.
            map:    (props) => ({ propertyId: props.propertyId, price: props.price }),
            reduce: (acc, props) => {
                if (props.price > 0 && (acc.price === 0 || props.price < acc.price)) {
                    acc.price = props.price;
                }
            },
        });

        sc.load(
            properties.map((p) => ({
                type: 'Feature' as const,
                properties: { propertyId: p.id, price: prices[p.id] ?? 0 },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [p.coordinates.lng, p.coordinates.lat] as [number, number],
                },
            })),
        );

        return sc;
    }, [properties, prices]);

    const clusters = useMemo(() => {
        if (!properties.length) return [];

        // No bounds yet (first paint, before the map reports a viewport): cluster the
        // whole world rather than render nothing, so markers appear on the first frame.
        const bbox: [number, number, number, number] = bounds
            ? [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat]
            : [-180, -85, 180, 85];

        // Supercluster indexes by integer zoom; a fractional zoom would round-trip
        // through Math.floor internally and recompute on every sub-pixel change.
        return index.getClusters(bbox, Math.round(zoom)) as ClusterOrPoint[];
    }, [index, bounds, zoom, properties.length]);

    const getExpansionZoom = useMemo(
        () => (clusterId: number): number | null => {
            try {
                const leaves = index.getLeaves(clusterId, Infinity);
                if (leaves.length === 0) return null;

                // Coincidence has to be tested on the points themselves. Comparing the
                // expansion zoom against maxZoom looks like the same test and is not:
                // at maxZoom every surviving cluster reports an expansion zoom one step
                // beyond it, so that check condemns ordinary clusters too — 398 Seoul
                // hotels and 268 Athens ones, against the ~30 that are really stacked.
                const [lng0, lat0] = leaves[0].geometry.coordinates;
                const allCoincident = leaves.every(
                    (l) => l.geometry.coordinates[0] === lng0 && l.geometry.coordinates[1] === lat0,
                );
                if (allCoincident) return null;

                return index.getClusterExpansionZoom(clusterId);
            } catch {
                return null;
            }
        },
        [index],
    );

    const getLeaves = useMemo(
        () => (clusterId: number): MappableProperty[] => {
            try {
                return index
                    .getLeaves(clusterId, Infinity)
                    .map((leaf) => byId[leaf.properties.propertyId])
                    .filter(Boolean);
            } catch {
                return [];
            }
        },
        [index, byId],
    );

    return { clusters, getExpansionZoom, getLeaves };
}
