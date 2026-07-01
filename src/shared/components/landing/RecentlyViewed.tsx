"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { History, Clock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SectionHeader, Badge } from '@/components/ui';
import { useRecentSearches, useSearchStore } from '@/stores';
import { type RecentItem } from '@/types';
import { convertCurrency } from '@/lib/currency';
import { formatCurrency } from '@/lib/utils';
import { useUserCurrency, type Destination } from '@/stores/searchStore';
import { IATA_TO_SLUG, findLocalDestinationImage } from '@/lib/destination-images';
import { useTranslations } from 'next-intl';

interface RecentCardProps {
  item: RecentItem;
  destination: Destination;
  index: number;
}

const RecentCard: React.FC<RecentCardProps> = ({ item, destination, index }) => {
  const t = useTranslations('landing.recentlyViewed');
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const userCurrency = useUserCurrency();
  const router = useRouter();
  const setDestination = useSearchStore((s) => s.setDestination);
  const setDestinationQuery = useSearchStore((s) => s.setDestinationQuery);

  const displayPrice = React.useMemo(() => {
    if (!destination.lowestPrice || destination.lowestPrice <= 0) return null;
    const converted = convertCurrency(destination.lowestPrice, destination.priceCurrency || 'USD', mounted ? userCurrency : (destination.priceCurrency || 'USD'));
    return formatCurrency(converted, mounted ? userCurrency : (destination.priceCurrency || 'USD'));
  }, [destination.lowestPrice, destination.priceCurrency, userCurrency, mounted]);

  const handleClick = () => {
    if (loading) return;
    setLoading(true);
    setDestination(destination);
    setDestinationQuery(destination.title);
    if (destination.type === 'airport') {
      router.push('/flights');
    } else {
      const params = new URLSearchParams({ destination: destination.title });
      if (destination.countryCode) params.set('countryCode', destination.countryCode);
      if (destination.id) params.set('placeId', destination.id);
      if (destination.code) params.set('destinationCode', destination.code);
      router.push(`/search?${params.toString()}`);
    }
  };

  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.08 }}
  >
    <motion.div
      onClick={handleClick}
      whileHover={loading ? {} : { scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`relative flex gap-2 sm:gap-3 p-2.5 sm:p-3 min-h-[88px] sm:min-h-[92px] bg-white dark:bg-slate-900/80 rounded-2xl border border-alabaster-border dark:border-obsidian-border shadow-md dark:shadow-black/20 overflow-hidden group ${loading ? 'cursor-wait' : 'cursor-pointer'}`}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-10">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      )}

      {/* Thumbnail — responsive */}
      <div className="relative w-14 h-14 min-[380px]:w-18 min-[380px]:h-18 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
          style={{ backgroundImage: `url(${item.image})` }}
        />
      </div>

      {/* Content — responsive typography */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[clamp(0.75rem,1.5vw,0.875rem)] font-display font-bold text-slate-900 dark:text-white truncate">
          {item.destination}
        </h3>
        <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1 text-[clamp(0.625rem,1.25vw,0.75rem)] text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3 sm:w-[11px] sm:h-[11px] shrink-0" />
          <span>{item.dates}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5 sm:mt-2 gap-1">
          <Badge variant="default" size="sm">{item.type}</Badge>
          {displayPrice ? (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-none">{t('from')}</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{displayPrice}</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>
          )}
        </div>
      </div>
    </motion.div>
  </motion.div>
  );
};

const RecentlyViewed = () => {
  const t = useTranslations('landing.recentlyViewed');
  // Get recent searches from Zustand store
  const recentSearches = useRecentSearches();

  if (recentSearches.length === 0) return null;

  const displayItems = recentSearches.map((search, index) => ({
    item: {
      id: String(index),
      destination: search.title,
      dates: t('recentlySearched'),
      type: search.type === 'airport' ? t('flight') : t('stay'),
      image: (() => {
        if (search.type === 'airport' && search.code) {
          const slug = IATA_TO_SLUG[search.code.toUpperCase()];
          return slug
            ? `/images/destinations/${slug}.jpg`
            : `/api/destination-photo?iata=${encodeURIComponent(search.code)}`;
        }
        return findLocalDestinationImage(search.title)
          ?? `/api/hotel-photo?q=${encodeURIComponent(`${search.title} travel destination`)}`;
      })(),
      price: search.lowestPrice ?? 0,
    } as RecentItem,
    destination: search,
  }));

  return (
    <section className="w-full pt-6 sm:pt-10 pb-2">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <SectionHeader
          title={t('title')}
          subtitle={t('subtitle')}
          icon={History}
          actionLabel={t('viewAll')}
          actionHref="/history"
        />

        {/* Scrollable Container */}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {displayItems.map(({ item, destination }, i) => (
            <div key={item.id} className="w-[85vw] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)] flex-none snap-start">
              <RecentCard item={item} destination={destination} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewed;
