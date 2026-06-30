import React from 'react';
import { MapPin, Star, Wifi, Car, Coffee, Utensils, Waves, Dumbbell, ParkingCircle, AirVent } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface PropertyInfoProps {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    starRating?: number;
    reviewScore?: number;
    reviewCount?: number;
    description?: string;
    amenities?: string[];
    propertyType?: string;
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
    wifi:       <Wifi size={14} />,
    internet:   <Wifi size={14} />,
    parking:    <ParkingCircle size={14} />,
    car:        <Car size={14} />,
    breakfast:  <Coffee size={14} />,
    restaurant: <Utensils size={14} />,
    pool:       <Waves size={14} />,
    gym:        <Dumbbell size={14} />,
    fitness:    <Dumbbell size={14} />,
    air:        <AirVent size={14} />,
};

function getAmenityIcon(name: string): React.ReactNode | null {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(AMENITY_ICONS)) {
        if (lower.includes(key)) return icon;
    }
    return null;
}

function getRatingLabel(score: number): string {
    if (score >= 9) return 'Exceptional';
    if (score >= 8) return 'Excellent';
    if (score >= 7) return 'Very Good';
    if (score >= 6) return 'Good';
    if (score >= 5) return 'Average';
    return 'Fair';
}

function getRatingBg(score: number): string {
    if (score >= 9) return 'bg-emerald-600';
    if (score >= 8) return 'bg-blue-600';
    if (score >= 7) return 'bg-blue-500';
    if (score >= 6) return 'bg-amber-500';
    return 'bg-orange-500';
}

export function PropertyInfo({
    name,
    address,
    city,
    country,
    starRating,
    reviewScore,
    reviewCount,
    description,
    amenities = [],
    propertyType,
}: PropertyInfoProps) {
    const locationText = [address, city, country].filter(Boolean).join(', ');
    const stars = starRating ? Math.min(5, Math.max(1, Math.round(starRating))) : 0;

    return (
        <div className="space-y-4">
            {/* Property type */}
            {propertyType && (
                <span className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    {propertyType}
                </span>
            )}

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                {name}
            </h1>

            {/* Star rating */}
            {stars > 0 && (
                <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            size={14}
                            className={cn(
                                i < stars
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-200 dark:text-slate-700 fill-current',
                            )}
                        />
                    ))}
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">{stars}-star hotel</span>
                </div>
            )}

            {/* Location */}
            {locationText && (
                <p className="flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <MapPin size={15} className="shrink-0 text-blue-400 mt-0.5" />
                    {locationText}
                </p>
            )}

            {/* Review score */}
            {reviewScore && reviewScore > 0 ? (
                <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-1 rounded-lg text-white text-sm font-bold', getRatingBg(reviewScore))}>
                        {reviewScore.toFixed(1)}
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {getRatingLabel(reviewScore)}
                        </p>
                        {reviewCount && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                {reviewCount.toLocaleString()} reviews
                            </p>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Description */}
            {description && (
                <div className="pt-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                        {description}
                    </p>
                </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
                <div className="pt-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Top amenities</h3>
                    <div className="flex flex-wrap gap-2">
                        {amenities.slice(0, 12).map((a) => {
                            const icon = getAmenityIcon(a);
                            return (
                                <span
                                    key={a}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs"
                                >
                                    {icon && <span className="text-blue-500">{icon}</span>}
                                    {a}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
