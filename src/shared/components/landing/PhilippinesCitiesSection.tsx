"use client";

import React, { useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useDragScroll } from '@/hooks/useDragScroll';
import { cityImagePath } from '@/lib/destination-images';
import { useTranslations } from 'next-intl';

interface City {
  name: string;
  country: string;
  tagline: string;
  searchQuery: string;
}

const TOP_CITIES: City[] = [
  { name: 'Tokyo',         country: 'Japan',           tagline: 'Where Tradition Meets the Future',     searchQuery: 'Tokyo, Japan' },
  { name: 'Paris',         country: 'France',          tagline: 'The City of Light & Love',             searchQuery: 'Paris, France' },
  { name: 'New York',      country: 'USA',             tagline: 'The City That Never Sleeps',           searchQuery: 'New York, USA' },
  { name: 'London',        country: 'United Kingdom',  tagline: 'History, Culture & Iconic Landmarks',  searchQuery: 'London, United Kingdom' },
  { name: 'Bangkok',       country: 'Thailand',        tagline: 'Temple of Wonder & Street Food',       searchQuery: 'Bangkok, Thailand' },
  { name: 'Singapore',     country: 'Singapore',       tagline: 'Garden City of Southeast Asia',        searchQuery: 'Singapore' },
  { name: 'Dubai',         country: 'UAE',             tagline: 'Luxury in the Desert',                 searchQuery: 'Dubai, UAE' },
  { name: 'Barcelona',     country: 'Spain',           tagline: 'Art, Architecture & the Mediterranean',searchQuery: 'Barcelona, Spain' },
  { name: 'Bali',          country: 'Indonesia',       tagline: 'Island of the Gods',                   searchQuery: 'Bali, Indonesia' },
  { name: 'Istanbul',      country: 'Turkey',          tagline: 'Where Europe Meets Asia',              searchQuery: 'Istanbul, Turkey' },
  { name: 'Sydney',        country: 'Australia',       tagline: 'Harbour City of the Southern Hemisphere', searchQuery: 'Sydney, Australia' },
  { name: 'Manila',        country: 'Philippines',     tagline: 'Capital & Cultural Heart',             searchQuery: 'Manila, Philippines' },
  { name: 'Seoul',         country: 'South Korea',     tagline: 'K-Culture & Culinary Capital',         searchQuery: 'Seoul, South Korea' },
  { name: 'Rome',          country: 'Italy',           tagline: 'The Eternal City',                     searchQuery: 'Rome, Italy' },
  { name: 'Kuala Lumpur',  country: 'Malaysia',        tagline: 'Twin Towers & Tropical Markets',       searchQuery: 'Kuala Lumpur, Malaysia' },
  { name: 'Amsterdam',     country: 'Netherlands',     tagline: 'Canals, Bikes & Golden Age Art',       searchQuery: 'Amsterdam, Netherlands' },
  { name: 'Hong Kong',     country: 'China',           tagline: 'East Meets West Skyline',              searchQuery: 'Hong Kong' },
  { name: 'Los Angeles',   country: 'USA',             tagline: 'Hollywood, Beaches & Sun',             searchQuery: 'Los Angeles, USA' },
];


interface CityCardProps {
  city: City;
  index: number;
}

const CityCard: React.FC<CityCardProps> = ({ city, index }) => {
  const router = useRouter();
  const t = useTranslations('topCities');

  function navigate() {
    const p = new URLSearchParams({
      destination: city.searchQuery,
      destinationType: 'city',
      country: city.country,
    });
    router.push(`/search?${p.toString()}`);
  }

  return (
    <motion.div
      initial={index === 0 ? false : { opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={navigate}
      className="shrink-0 snap-start cursor-pointer"
      style={{ width: 'max(160px, calc((100% - 60px) / 5))' }}
    >
      <div className="relative h-[160px] overflow-hidden rounded-sm group">
        <Image
          src={cityImagePath(city.name)}
          alt={city.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 180px, (max-width: 768px) 200px, 240px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          loading={index < 2 ? 'eager' : 'lazy'}
        />

        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/20 to-black/80" />

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <MapPin className="w-2.5 h-2.5 text-white" />
          <span className="text-[10px] text-white leading-none">{city.country}</span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
          <h3 className="text-[16px] font-bold text-white leading-tight">{city.name}</h3>
          <p className="text-[10px] text-white/80 leading-snug mt-0.5 truncate">{city.tagline}</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="bg-white/90 text-slate-900 text-[11px] font-semibold px-4 py-1.5 rounded-full shadow-lg">
            {t('exploreHotels')}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const TopCitiesSection: React.FC = () => {
  const t = useTranslations('topCities');
  const { ref: rowRef, dragProps } = useDragScroll<HTMLDivElement>();
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="w-full py-2 md:py-4 lg:py-5">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-white">
              {t('headerMain')}{' '}
              <span className="text-blue-600 dark:text-blue-400">{t('headerHighlight')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div
          ref={rowRef}
          {...dragProps}
          className="flex overflow-x-auto snap-x snap-mandatory gap-3 pt-5 pb-3 -mt-5 -mx-4 sm:-mx-6 px-4 sm:px-6 scroll-px-4 sm:scroll-px-6 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {TOP_CITIES.map((city, i) => (
            <CityCard key={city.name} city={city} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
};

export default TopCitiesSection;
