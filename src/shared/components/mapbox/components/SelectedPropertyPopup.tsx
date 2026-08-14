import React from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { X, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { MapMarker } from '@/shared/components/map/MapMarker';
import type { MappableProperty } from '@/shared/components/map/types';
import { useUserCurrency } from '@/stores/searchStore';
import { convertCurrency } from '@/shared/lib/currency';
import { formatCurrency } from '@/shared/lib/format';
import { http } from '@/shared/lib/http';

interface SelectedPropertyPopupProps {
    selectedProperty: MappableProperty | null;
    onClose: () => void;
    onViewDetails: (id: string) => void;
    onSelect: (id: string) => void;
    isMobile?: boolean;
}

/** Card geometry, from the design's 234px artboard. */
const CARD_W   = 234;
/** The photo frame the gallery pages through. */
const IMG_H    = 150;

/**
 * Most dots the strip will draw.
 *
 * A hotel can carry thirty room photos, and thirty dots is a ruler, not an
 * indicator. Past this the strip stops being one-dot-per-photo and becomes a
 * position gauge: the lit dot tracks how far through the gallery you are, and
 * tapping one jumps to that fraction of it.
 */
const MAX_DOTS = 8;

/**
 * How far above the coordinate the card floats.
 *
 * The pin anchors its own bottom to the same point and stands 46px tall — a
 * 36px pill over an 11px pointer, overlapping by 1 — which becomes ~56px under
 * the 1.2× it wears while selected, and selected is the only state that opens
 * this card. Clearance is measured from that, plus a little air.
 */
const PIN_CLEARANCE = 62;

// ─── Detail fetch ─────────────────────────────────────────────────────────────

interface HotelContent {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    description?: string | null;
    images?: string[] | null;
    review_rating?: number | string | null;
}

interface PropertyResponse {
    content?: HotelContent;
    reviews?: { rating: number | string | null; reviews_count: number } | null;
}

/**
 * The hotel's own content — room photography, street address, description.
 *
 * The search stream carries only enough to draw a pin, so the card opens on
 * that stub and upgrades in place when this lands. Fetching on select rather
 * than for every pin on screen: this is one request per card actually opened,
 * against an API that rate-limits by IP.
 */
function useHotelContent(hotelId: string | null) {
    const [content, setContent] = React.useState<HotelContent | null>(null);
    const [reviewRating, setReviewRating] = React.useState<number | null>(null);

    React.useEffect(() => {
        setContent(null);
        setReviewRating(null);
        if (!hotelId) return;

        let cancelled = false;
        http.get<PropertyResponse>(`/api/hotels/property/${hotelId}`)
            .then((res) => {
                if (cancelled) return;
                if (res.content) setContent(res.content);
                const r = Number(res.reviews?.rating ?? res.content?.review_rating);
                if (Number.isFinite(r) && r > 0) setReviewRating(r);
            })
            // A preview that cannot load its detail still shows the stub it
            // opened with, so a failure here is not worth surfacing.
            .catch(() => { /* keep the stub */ });

        return () => { cancelled = true; };
    }, [hotelId]);

    return { content, reviewRating };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/** The current photo, or the stand-in when there is none or it fails to load. */
function PhotoFrame({ src, alt }: { src?: string; alt: string }) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);

    if (!src || failed) {
        return (
            <div style={{
                position: 'absolute', inset: 0, color: 'var(--map-card-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Building2 size={24} />
            </div>
        );
    }

    return (
        // A plain <img>: next/image only permits https remotes here, and the API
        // is reached over http in development.
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
            }}
        />
    );
}

/**
 * A gallery arrow. Its own scrim rather than the card well — these sit on
 * photography, which the well is far too faint to read against.
 *
 * The chevron rocks outward on a loop (see globals.css) so the card shows that
 * there is more behind the photo on screen. The motion is on the glyph, not the
 * button, because the button's transform is already spent on centring it.
 */
function GalleryArrow({ side, onClick, label }: {
    side: 'left' | 'right';
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-100"
            style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left:  side === 'left'  ? 8 : undefined,
                right: side === 'right' ? 8 : undefined,
                zIndex: 2, width: 24, height: 24,
                background: 'rgba(0,0,0,0.45)', color: '#FFFFFF',
                border: 'none', padding: 0, opacity: 0.9,
                backdropFilter: 'blur(4px)',
            }}
        >
            <span className={`flex map-gallery-arrow-${side}`}>
                {side === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </span>
        </button>
    );
}

/**
 * Position within the gallery, and a way to jump around it.
 *
 * Sits on the photo rather than under it, as drawn — so it needs its own
 * contrast against whatever the photo happens to be, hence the shadow on every
 * dot rather than a scrim behind the strip.
 */
function GalleryDots({ count, active, onSelect }: {
    count: number;
    active: number;
    onSelect: (i: number) => void;
}) {
    return (
        <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 8, zIndex: 2,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        }}>
            {Array.from({ length: count }, (_, i) => {
                const isActive = i === active;
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onSelect(i)}
                        aria-label={`Go to photo ${i + 1}`}
                        aria-current={isActive}
                        className="cursor-pointer"
                        style={{
                            // The lit dot stretches rather than growing, so the
                            // strip keeps its height and only its rhythm changes.
                            width: isActive ? 13 : 5, height: 5,
                            borderRadius: 100, padding: 0, border: 'none',
                            background: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
                            transition: 'width 220ms ease, background 220ms ease',
                        }}
                    />
                );
            })}
        </div>
    );
}

/**
 * The preview that opens above a hotel's pin: its rooms, where it is, what a
 * night costs, and the way through to the full listing.
 *
 * Colours come from `--map-card-*` (globals.css) — the same surface the POI
 * preview uses — so both cards invert together against the basemap.
 */
function HotelPreviewCard({
    property, content, reviewRating, onClose, onViewDetails,
}: {
    property: MappableProperty;
    content: HotelContent | null;
    reviewRating: number | null;
    onClose: () => void;
    onViewDetails: (id: string) => void;
}) {
    const currency = useUserCurrency();

    // Detail photos when they arrive, the pin's own thumbnail until then.
    const photos = (content?.images?.length ? content.images : property.images ?? []).filter(Boolean);
    const name = content?.name ?? property.name;

    // Paging the gallery. The index resets per hotel, and is taken modulo the
    // length on read so the shorter stub gallery being replaced by the longer
    // detail one — or the reverse — can never leave it pointing past the end.
    const [photoIndex, setPhotoIndex] = React.useState(0);
    React.useEffect(() => setPhotoIndex(0), [property.id]);
    const shownIndex = photos.length ? ((photoIndex % photos.length) + photos.length) % photos.length : 0;
    const page = (step: number) => setPhotoIndex(shownIndex + step);

    // One dot per photo up to MAX_DOTS; past that the strip is a gauge and the
    // two map onto each other proportionally.
    const dotCount = Math.min(photos.length, MAX_DOTS);
    const lastDot  = Math.max(1, dotCount - 1);
    const lastPhoto = Math.max(1, photos.length - 1);
    const activeDot = photos.length <= MAX_DOTS
        ? shownIndex
        : Math.round((shownIndex / lastPhoto) * lastDot);
    const goToDot = (i: number) => setPhotoIndex(
        photos.length <= MAX_DOTS ? i : Math.round((i / lastDot) * lastPhoto),
    );

    // The street address is what the design shows. Falling back through the
    // stub's coarser location fields, then to the description's opening clause
    // when a property has no address at all.
    const address =
        [content?.address, content?.city, content?.country].filter(Boolean).join(', ') ||
        [property.location, property.city, property.country].filter(Boolean).join(', ') ||
        content?.description?.split(/(?<=\.)\s/)[0] ||
        '';

    let priceLabel = '';
    try {
        priceLabel = property.priceLoading
            ? ''
            : `${formatCurrency(
                convertCurrency(property.price, property.currency || 'USD', currency),
                currency,
            )}/ night`;
    } catch { /* an unknown currency just drops the line */ }

    const rating = reviewRating ?? property.rating ?? property.reviewScore ?? null;

    return (
        <div style={{
            position: 'relative', width: CARD_W,
            borderRadius: 16,
            // The mosaic runs to the card's edges and is clipped to its corners
            // here rather than carrying radii of its own, so the two curves
            // cannot drift apart.
            overflow: 'hidden',
            background: 'var(--map-card-bg)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.38)',
        }}>
            <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${name} preview`}
                className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80"
                style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 3,
                    width: 24, height: 24,
                    // Its own scrim rather than the card well: this one sits on
                    // photography, which the well is too faint to read against.
                    background: 'rgba(0,0,0,0.55)',
                    color: '#FFFFFF',
                    border: 'none', padding: 0,
                    backdropFilter: 'blur(4px)',
                }}
            >
                <X size={13} strokeWidth={2.5} />
            </button>

            {/* One room at a time, paged. The arrows are drawn only when there
                is somewhere to go, so a hotel with a single photo shows a clean
                frame rather than two controls that do nothing. */}
            <div style={{
                position: 'relative', height: IMG_H, overflow: 'hidden',
                background: 'var(--map-card-well)',
            }}>
                <PhotoFrame
                    src={photos[shownIndex]}
                    alt={`${name} room ${shownIndex + 1}`}
                />
                {photos.length > 1 && (
                    <>
                        <GalleryArrow side="left"  onClick={() => page(-1)} label="Previous room photo" />
                        <GalleryArrow side="right" onClick={() => page(1)}  label="Next room photo" />
                        <GalleryDots count={dotCount} active={activeDot} onSelect={goToDot} />
                    </>
                )}
            </div>

            {/* `flex-end` rather than centre: the design hangs the button off the
                bottom of the text block, not the middle of it. */}
            <div style={{ padding: '11px 12px 12px' }}>
                <h3 style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--map-card-fg)', lineHeight: 1.25,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {name}
                </h3>
                {address && (
                    <p style={{
                        fontSize: 9.5, color: 'var(--map-card-muted)', marginTop: 3, lineHeight: 1.35,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {address}
                    </p>
                )}

                {/* Price over rating, with the button beside the pair. Stacking
                    them is what buys the button its room at this width — side by
                    side they left it nothing to sit in. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {priceLabel && (
                            <p style={{
                                fontSize: 10.5, fontWeight: 700, color: 'var(--map-card-fg)', lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {priceLabel}
                            </p>
                        )}
                        {rating !== null && rating > 0 && (
                            <p style={{
                                fontSize: 10.5, color: 'var(--map-card-fg)', marginTop: 3, lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {rating.toFixed(1)} rating
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onViewDetails(property.id)}
                        className="inline-flex items-center justify-center shrink-0 cursor-pointer transition-opacity hover:opacity-85"
                        style={{
                            height: 30, padding: '0 14px', borderRadius: 100,
                            // The chip inversion the rail cards use for View Stay.
                            background: 'var(--map-card-fg)', color: 'var(--map-card-bg)',
                            border: 'none', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                        View Stay
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Marker + preview ─────────────────────────────────────────────────────────

export const SelectedPropertyPopup = React.memo(({
    selectedProperty,
    onClose,
    onViewDetails,
    onSelect,
}: SelectedPropertyPopupProps) => {
    const targetCurrency = useUserCurrency();
    // Hooks run unconditionally; the id going null is what clears the fetch.
    const { content, reviewRating } = useHotelContent(selectedProperty?.id ?? null);

    if (!selectedProperty) return null;

    return (
        <>
            <MapMarker
                property={selectedProperty}
                displayPrice={convertCurrency(selectedProperty.price, selectedProperty.currency || 'USD', targetCurrency)}
                displayCurrency={targetCurrency}
                isSelected={true}
                isHovered={false}
                onClick={() => onSelect(selectedProperty.id)}
                onHover={() => {}}
            />

            <Popup
                latitude={selectedProperty.coordinates.lat}
                longitude={selectedProperty.coordinates.lng}
                anchor="bottom"
                offset={PIN_CLEARANCE}
                closeOnClick={false}
                closeButton={false}
                onClose={onClose}
                className="map-hotel-popup"
                maxWidth={`${CARD_W}px`}
            >
                <HotelPreviewCard
                    property={selectedProperty}
                    content={content}
                    reviewRating={reviewRating}
                    onClose={onClose}
                    onViewDetails={onViewDetails}
                />
            </Popup>
        </>
    );
});
