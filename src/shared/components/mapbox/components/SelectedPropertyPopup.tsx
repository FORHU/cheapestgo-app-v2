import React from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { X, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { MapMarker } from '@/shared/components/map/MapMarker';
import type { MappableProperty } from '@/shared/components/map/types';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertCurrency } from '@/shared/lib/currency';
import { formatCurrency } from '@/shared/lib/format';
import { http } from '@/shared/lib/http';

interface SelectedPropertyPopupProps {
    selectedProperty: MappableProperty | null;
    onClose: () => void;
    onViewDetails: (id: string) => void;
    onSelect: (id: string) => void;
    isMobile?: boolean;
    nights?: number;
}

/**
 * Card geometry, from the design's 234 × 268 artboard.
 *
 * The height is fixed because the photo *is* the card — there is no panel for it
 * to size itself to, so the box is the design's rather than the copy's.
 */
const CARD_W = 234;
const CARD_H = 268;
/**
 * The card's ink. Always white: it sits on photography under a scrim, not on
 * a flat `--map-card-bg` surface, so unlike the POI discs it has no theme of
 * its own to follow — a photo can be any tone, so the ink stays fixed rather
 * than chasing it.
 */
const ON_PHOTO       = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.72)';

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
 * How long a room photo holds before the card moves to the next one.
 *
 * Long enough to actually look at a room, short enough that a card opened for a
 * few seconds shows more than one. Re-armed on every change rather than run as
 * an interval, so a photo reached by tapping an arrow gets the same full dwell
 * as one the timer brought up.
 */
const AUTOPLAY_MS = 3400;

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
        http.get<PropertyResponse>(`/hotels/property/${hotelId}`)
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
function PhotoFrame({ src, alt, fallbackColor = 'var(--map-card-muted)' }: {
    src?: string;
    alt: string;
    /**
     * The stand-in's ink. The desktop frame sits in the card well and takes the
     * card's muted tone; the phone card's ground is a fixed near-black, where
     * that tone would be dark-on-dark in light mode.
     */
    fallbackColor?: string;
}) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);

    if (!src || failed) {
        return (
            <div style={{
                position: 'absolute', inset: 0, color: fallbackColor,
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
function GalleryArrow({ side, onClick, label, top = '50%', size = 24, nudge = true }: {
    side: 'left' | 'right';
    onClick: () => void;
    label: string;
    /**
     * Where to centre it. The desktop card's photo is a band, so the arrows sit
     * halfway down it. The phone card's photo is the whole card with copy over
     * its foot, so halfway down would put them on the hotel's name — they take
     * the middle of the *clear* part of the photo instead.
     */
    top?: string;
    /** Bigger on the phone card, where this is a thumb target next to a tap
     *  target that navigates. */
    size?: number;
    /** The idle rock. Off while the gallery is advancing on its own — the moving
     *  photos already say there are more, and a rocking chevron on top of that
     *  is one animation too many on a card this size. */
    nudge?: boolean;
}) {
    return (
        <button
            type="button"
            // The phone card is itself a tap target that opens the listing, so
            // paging the gallery must stop here.
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            aria-label={label}
            className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-100"
            style={{
                position: 'absolute', top, transform: 'translateY(-50%)',
                left:  side === 'left'  ? 8 : undefined,
                right: side === 'right' ? 8 : undefined,
                zIndex: 2, width: size, height: size,
                background: 'rgba(0,0,0,0.45)', color: '#FFFFFF',
                border: 'none', padding: 0, opacity: 0.9,
                backdropFilter: 'blur(4px)',
            }}
        >
            <span className={nudge ? `flex map-gallery-arrow-${side}` : 'flex'}>
                {side === 'left'
                    ? <ChevronLeft  size={Math.round(size * 0.58)} />
                    : <ChevronRight size={Math.round(size * 0.58)} />}
            </span>
        </button>
    );
}

/**
 * Position within the gallery, and a way to jump around it.
 *
 * Hangs off the bottom of the copy, as drawn, rather than floating on the photo.
 * It is still over photography either way — the scrim is a darkened photo, not a
 * surface — so the dots are white and carry their own shadow rather than taking
 * the card's ink.
 */
function GalleryDots({ count, active, onSelect }: {
    count: number;
    active: number;
    onSelect: (i: number) => void;
}) {
    return (
        <div style={{
            marginTop: 10,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        }}>
            {Array.from({ length: count }, (_, i) => {
                const isActive = i === active;
                return (
                    <button
                        key={i}
                        type="button"
                        // The whole card is a tap target — see HotelPreviewCard —
                        // so paging must not also open the listing under it.
                        onClick={(e) => { e.stopPropagation(); onSelect(i); }}
                        aria-label={`Go to photo ${i + 1}`}
                        aria-current={isActive}
                        className="cursor-pointer"
                        style={{
                            // The lit dot stretches rather than growing, so the
                            // strip keeps its height and only its rhythm changes.
                            width: isActive ? 13 : 5, height: 5,
                            borderRadius: 100, padding: 0, border: 'none',
                            background: isActive ? ON_PHOTO : 'rgba(255,255,255,0.55)',
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
 * One layout at every width. It used to be two — a photo band over a panel with
 * a View Stay pill on the desktop, the design's full-bleed portrait on the phone
 * — which meant the same object read as two different products depending on the
 * window. The portrait is now both.
 *
 * The photo is the card's entire ground, with a scrim over its foot carrying the
 * name, address, price and rating. There is no pill: dropping it is what gives
 * the copy the full width, and beside a button a peso price had roughly half the
 * card and truncated. The card itself is the target in its place, which is also
 * why everything on top of it — the close button, the arrows, the dots — has to
 * stop its own click.
 *
 * Only the arrows still know about `isMobile`, and only for their size: on a
 * phone they are a thumb target next to a tap target that navigates.
 */
function HotelPreviewCard({
    property, content, reviewRating, onClose, onViewDetails, isMobile, nights,
}: {
    property: MappableProperty;
    content: HotelContent | null;
    reviewRating: number | null;
    onClose: () => void;
    onViewDetails: (id: string) => void;
    isMobile: boolean;
    nights: number;
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

    /**
     * Whether the visitor has started paging the gallery themselves.
     *
     * Once they have, the timer stops for good. A carousel that keeps pulling
     * ahead while someone is working back through it is just fighting them —
     * and handing over on first use is also the pause mechanism WCAG 2.2.2 asks
     * for on content that would otherwise animate indefinitely. Reset per
     * hotel, since the next card is a fresh gallery.
     */
    const [userPaging, setUserPaging] = React.useState(false);
    React.useEffect(() => setUserPaging(false), [property.id]);

    const reduceMotion = useReducedMotion();
    const autoplaying = photos.length > 1 && !userPaging && !reduceMotion;

    // A timeout re-armed on each change, not an interval: every photo then gets
    // a full dwell whether the timer or a tap brought it up.
    React.useEffect(() => {
        if (!autoplaying) return;
        const t = setTimeout(() => setPhotoIndex(i => i + 1), AUTOPLAY_MS);
        return () => clearTimeout(t);
    }, [autoplaying, shownIndex]);

    const page = (step: number) => { setUserPaging(true); setPhotoIndex(shownIndex + step); };

    // One dot per photo up to MAX_DOTS; past that the strip is a gauge and the
    // two map onto each other proportionally.
    const dotCount = Math.min(photos.length, MAX_DOTS);
    const lastDot  = Math.max(1, dotCount - 1);
    const lastPhoto = Math.max(1, photos.length - 1);
    const activeDot = photos.length <= MAX_DOTS
        ? shownIndex
        : Math.round((shownIndex / lastPhoto) * lastDot);
    const goToDot = (i: number) => {
        setUserPaging(true);
        setPhotoIndex(photos.length <= MAX_DOTS ? i : Math.round((i / lastDot) * lastPhoto));
    };

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
                convertCurrency(property.price, property.currency || 'USD', currency) / nights,
                currency,
            )}/ night`;
    } catch { /* an unknown currency just drops the line */ }

    const rating = reviewRating ?? property.rating ?? property.reviewScore ?? null;

    /** Bigger where a thumb has to hit it. */
    const arrowSize = isMobile ? 30 : 24;

    return (
        <div
            onClick={() => onViewDetails(property.id)}
            style={{
                position: 'relative', width: CARD_W, height: CARD_H,
                borderRadius: 16,
                // The photo runs to the card's edges and is clipped to its corners
                // here rather than carrying radii of its own, so the two curves
                // cannot drift apart.
                overflow: 'hidden',
                // Fixed rather than `--map-card-bg`: every mark on this card is
                // white, over photography. A light surface underneath it in light
                // mode would show only where the photo has not loaded, and read
                // as a flash of the wrong card.
                background: '#121212',
                boxShadow: '0 10px 30px rgba(0,0,0,0.38)',
                cursor: 'pointer',
            }}
        >
            <PhotoFrame
                src={photos[shownIndex]}
                alt={`${name} room ${shownIndex + 1}`}
                fallbackColor="rgba(255,255,255,0.30)"
            />

            {/* The scrim the copy stands on. Four stops rather than two: a
                straight fade leaves a visible band where it meets the photo, and
                the eye catches that edge before it catches the name. */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: '68%',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.86) 30%, rgba(0,0,0,0.48) 64%, rgba(0,0,0,0) 100%)',
                }}
            />

            {/* Its own scrim rather than the card well: this sits on photography,
                which the well is far too faint to read against. */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label={`Close ${name} preview`}
                className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80"
                style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 3,
                    width: 24, height: 24,
                    background: 'rgba(0,0,0,0.55)',
                    color: ON_PHOTO,
                    border: 'none', padding: 0,
                    backdropFilter: 'blur(4px)',
                }}
            >
                <X size={13} strokeWidth={2.5} />
            </button>

            {/* Centred on the clear half of the photo rather than on the card:
                halfway down would put them on the hotel's name. Drawn only when
                there is somewhere to go, so a hotel with one photo shows a clean
                frame instead of two controls that do nothing. */}
            {photos.length > 1 && (
                <>
                    <GalleryArrow side="left"  onClick={() => page(-1)} label="Previous room photo" top="32%" size={arrowSize} nudge={!autoplaying} />
                    <GalleryArrow side="right" onClick={() => page(1)}  label="Next room photo"     top="32%" size={arrowSize} nudge={!autoplaying} />
                </>
            )}

            {/* Anchored to the bottom edge, so a one-line address and a two-line
                one both leave the price where the eye expects it. */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 13px 11px' }}>
                <h3 style={{
                    fontSize: 13.5, fontWeight: 700, color: ON_PHOTO, lineHeight: 1.25,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {name}
                </h3>
                {address && (
                    <p style={{
                        fontSize: 10, color: ON_PHOTO_MUTED, marginTop: 3, lineHeight: 1.35,
                        // The full card width to itself, so a long street address
                        // wraps rather than being cut.
                        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                        overflow: 'hidden',
                    }}>
                        {address}
                    </p>
                )}
                {priceLabel && (
                    <p style={{
                        fontSize: 12, fontWeight: 700, color: ON_PHOTO, marginTop: 6, lineHeight: 1.3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {priceLabel}
                    </p>
                )}
                {rating !== null && rating > 0 && (
                    <p style={{ fontSize: 10, color: ON_PHOTO_MUTED, marginTop: 2, lineHeight: 1.35 }}>
                        {rating.toFixed(1)} rating
                    </p>
                )}
                {photos.length > 1 && (
                    <GalleryDots count={dotCount} active={activeDot} onSelect={goToDot} />
                )}
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
    isMobile = false,
    nights = 1,
}: SelectedPropertyPopupProps) => {
    const targetCurrency = useUserCurrency();
    // Hooks run unconditionally; the id going null is what clears the fetch.
    const { content, reviewRating } = useHotelContent(selectedProperty?.id ?? null);

    if (!selectedProperty) return null;

    return (
        <>
            <MapMarker
                property={selectedProperty}
                displayPrice={convertCurrency(selectedProperty.price, selectedProperty.currency || 'USD', targetCurrency) / nights}
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
                    isMobile={isMobile}
                    nights={nights}
                />
            </Popup>
        </>
    );
});


// `React.memo` returns an anonymous object, so React DevTools and the
// react/display-name rule both need the name spelled out.
SelectedPropertyPopup.displayName = 'SelectedPropertyPopup';
