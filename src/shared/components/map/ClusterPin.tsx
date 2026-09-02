'use client';

/**
 * The marker standing in for several hotels that are too close together to draw
 * separately at the current zoom.
 *
 * Deliberately shaped like `HotelPin` — same pill, same radius, same shadow and CSS
 * variables — with the hotel's thumbnail replaced by a count. A cluster is a hotel
 * marker that happens to represent more than one, and it should read that way rather
 * than as a different kind of object on the map.
 *
 * Styled inline for the same reason HotelPin is: these render into detached React
 * roots attached to Mapbox marker elements, outside the app's stylesheet cascade.
 */

const THUMB = 34;

interface ClusterPinProps {
    /** How many hotels this marker stands for. */
    count: number;
    /** Cheapest among them, already formatted and converted. Empty when unpriced. */
    priceLabel: string;
    active?: boolean;
}

export function ClusterPin({ count, priceLabel, active = false }: ClusterPinProps) {
    const shadow = active ? '0 6px 18px rgba(0,0,0,0.34)' : '0 2px 9px rgba(0,0,0,0.22)';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: `scale(${active ? 1.15 : 1})`,
                transformOrigin: 'center bottom',
                transition: 'transform 220ms cubic-bezier(0.34, 1.3, 0.64, 1)',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--pin-bg)',
                    borderRadius: 100,
                    padding: '4px 14px 4px 4px',
                    boxShadow: shadow,
                    whiteSpace: 'nowrap',
                }}
            >
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: THUMB,
                        height: THUMB,
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#667eea,#764ba2)',
                        boxShadow: 'inset 0 0 0 1px var(--pin-line)',
                        color: '#fff',
                        fontWeight: 700,
                        // Three digits still have to fit inside the same circle the
                        // hotel thumbnail occupies, so the type shrinks rather than
                        // the pin growing and shifting every neighbouring marker.
                        fontSize: count > 99 ? 11 : count > 9 ? 13 : 15,
                        lineHeight: 1,
                    }}
                >
                    {count > 999 ? '999+' : count}
                </span>

                <span
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        lineHeight: 1.15,
                        color: 'var(--pin-fg, #0f172a)',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    <span style={{ opacity: 0.62, fontSize: 10, fontWeight: 600 }}>
                        {count} hotels
                    </span>
                    {priceLabel && <span>{`from ${priceLabel}`}</span>}
                </span>
            </div>
        </div>
    );
}
