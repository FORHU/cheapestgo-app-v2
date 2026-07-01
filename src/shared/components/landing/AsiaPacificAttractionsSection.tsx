"use client";

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useDragScroll } from '@/hooks/useDragScroll';
import { attractionImagePath } from '@/lib/destination-images';
import { useTranslations } from 'next-intl';

interface Attraction {
  name: string;
  location: string;
  country: string;
  tagline: string;
  searchQuery: string;
}

const ATTRACTIONS: Attraction[] = [
  { name: 'Eiffel Tower',       location: 'Paris',         country: 'France',        tagline: 'Icon of the City of Light',            searchQuery: 'Paris, France' },
  { name: 'Colosseum',          location: 'Rome',          country: 'Italy',         tagline: 'Arena of the Ancient World',           searchQuery: 'Rome, Italy' },
  { name: 'Machu Picchu',       location: 'Peru',          country: 'Peru',          tagline: 'Lost City of the Incas',               searchQuery: 'Cusco, Peru' },
  { name: 'Santorini',          location: 'Greece',        country: 'Greece',        tagline: 'Blue Domes & Aegean Sunsets',          searchQuery: 'Santorini, Greece' },
  { name: 'Bali',               location: 'Indonesia',     country: 'Indonesia',     tagline: 'Island of the Gods',                   searchQuery: 'Bali, Indonesia' },
  { name: 'Angkor Wat',         location: 'Cambodia',      country: 'Cambodia',      tagline: 'Ancient Khmer Empire',                 searchQuery: 'Siem Reap, Cambodia' },
  { name: 'Safari — Serengeti', location: 'Tanzania',      country: 'Tanzania',      tagline: 'Greatest Wildlife Show on Earth',      searchQuery: 'Serengeti, Tanzania' },
  { name: 'Grand Canyon',       location: 'Arizona',       country: 'USA',           tagline: 'Nature\'s Most Dramatic Masterpiece',  searchQuery: 'Grand Canyon, USA' },
  { name: 'Boracay',            location: 'Philippines',   country: 'Philippines',   tagline: 'World-Famous White Sand Beaches',      searchQuery: 'Boracay, Philippines' },
  { name: 'Mount Fuji',         location: 'Japan',         country: 'Japan',         tagline: 'Japan\'s Sacred Iconic Peak',          searchQuery: 'Mount Fuji, Japan' },
  { name: 'Ha Long Bay',        location: 'Vietnam',       country: 'Vietnam',       tagline: 'Emerald Waters & Limestone Karsts',    searchQuery: 'Ha Long Bay, Vietnam' },
  { name: 'Taj Mahal',          location: 'Agra',          country: 'India',         tagline: 'Eternal Monument to Love',             searchQuery: 'Agra, India' },
  { name: 'Phuket',             location: 'Thailand',      country: 'Thailand',      tagline: 'Thailand\'s Pearl of the Andaman',     searchQuery: 'Phuket, Thailand' },
  { name: 'Northern Lights',    location: 'Iceland',       country: 'Iceland',       tagline: 'Nature\'s Most Magical Light Show',    searchQuery: 'Reykjavik, Iceland' },
  { name: 'Pyramids of Giza',   location: 'Egypt',         country: 'Egypt',         tagline: 'Wonder of the Ancient World',          searchQuery: 'Cairo, Egypt' },
  { name: 'Palawan',            location: 'Philippines',   country: 'Philippines',   tagline: 'The Last Frontier',                    searchQuery: 'Palawan, Philippines' },
  { name: 'Amalfi Coast',       location: 'Italy',         country: 'Italy',         tagline: 'Clifftop Villages & Azure Waters',     searchQuery: 'Amalfi, Italy' },
  { name: 'Great Barrier Reef', location: 'Australia',     country: 'Australia',     tagline: 'World\'s Largest Coral Reef',          searchQuery: 'Cairns, Australia' },
  { name: 'Jeju Island',        location: 'South Korea',   country: 'South Korea',   tagline: 'Island of Wind, Women & Rocks',        searchQuery: 'Jeju Island, South Korea' },
  { name: 'Maldives',           location: 'Maldives',      country: 'Maldives',      tagline: 'Overwater Bungalows & Crystal Lagoons',searchQuery: 'Maldives' },
];


interface AttractionCardProps {
  attraction: Attraction;
  index: number;
}

const AttractionCard: React.FC<AttractionCardProps> = ({ attraction, index }) => {
  const router = useRouter();
  const t = useTranslations('topDestinations');

  function navigate() {
    const p = new URLSearchParams({
      destination: attraction.searchQuery,
      destinationType: 'city',
      country: attraction.country,
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
          src={attractionImagePath(attraction.name)}
          alt={attraction.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 180px, (max-width: 768px) 200px, 240px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          loading={index < 2 ? 'eager' : 'lazy'}
        />

        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/20 to-black/80" />

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
          <span className="text-[10px] text-white leading-none">{attraction.location}</span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
          <h3 className="text-[15px] font-bold text-white leading-tight">{attraction.name}</h3>
          <p className="text-[10px] text-white/80 leading-snug mt-0.5 truncate">{attraction.tagline}</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="bg-white/90 text-slate-900 text-[11px] font-semibold px-4 py-1.5 rounded-full shadow-lg">
            {t('findHotels')}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const TopDestinationsSection: React.FC = () => {
  const t = useTranslations('topDestinations');
  const { ref: rowRef, dragProps } = useDragScroll<HTMLDivElement>();

  return (
    <section className="w-full py-2 md:py-4 lg:py-5">
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
          {ATTRACTIONS.map((attraction, i) => (
            <AttractionCard key={attraction.name} attraction={attraction} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
};

export default TopDestinationsSection;
