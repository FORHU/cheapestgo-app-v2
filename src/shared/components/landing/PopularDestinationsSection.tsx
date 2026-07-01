'use client';

import Image from 'next/image';
import Link from 'next/link';
import { POPULAR_DESTINATIONS } from '@/shared/lib/destinations';
import { useDragScroll } from '@/shared/hooks/useDragScroll';

export function PopularDestinationsSection() {
    const { ref, dragProps } = useDragScroll<HTMLDivElement>();

    return (
        <section className="w-full py-8 md:py-12">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">
                    Popular Destinations
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-5 text-sm md:text-base">
                    Explore top spots across Asia-Pacific — search flights and hotels in seconds.
                </p>
            </div>

            <div
                ref={ref}
                {...dragProps}
                className="flex gap-3 overflow-x-auto scroll-smooth px-4 sm:px-6 pb-2"
                style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            >
                {POPULAR_DESTINATIONS.map((dest) => (
                    <Link
                        key={dest.id}
                        href={`/?destination=${encodeURIComponent(dest.city)}`}
                        className="group relative shrink-0 w-[160px] sm:w-[200px] md:w-[220px] aspect-[3/4] rounded-2xl overflow-hidden block"
                        style={{ scrollSnapAlign: 'start' }}
                    >
                        <Image
                            src={dest.imagePath}
                            alt={`${dest.city}, ${dest.country}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 220px"
                            draggable={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-3">
                            <p className="text-white font-semibold text-sm leading-tight">{dest.city}</p>
                            <p className="text-white/75 text-xs mt-0.5">{dest.country}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
