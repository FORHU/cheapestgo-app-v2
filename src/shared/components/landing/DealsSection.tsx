"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { type Deal } from '@/types';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useTranslations } from 'next-intl';

// ── IATA lookups ──────────────────────────────────────────────────────────────
const AIRPORT_CITIES: Record<string, string> = {
  HKG: 'Hong Kong',       SIN: 'Singapore',          ICN: 'Seoul',
  GMP: 'Seoul',           KIX: 'Osaka',              NRT: 'Tokyo',
  HND: 'Tokyo',           TYO: 'Tokyo',              BKK: 'Bangkok',
  DMK: 'Bangkok',         KUL: 'Kuala Lumpur',       MNL: 'Manila',
  // Philippine airports
  CEB: 'Cebu',            CRK: 'Clark',              DVO: 'Davao',
  ILO: 'Iloilo',          BCD: 'Bacolod',            TAG: 'Tagbilaran',
  KLO: 'Kalibo',          MPH: 'Caticlan',           PPS: 'Puerto Princesa',
  ZAM: 'Zamboanga',       CYP: 'Calbayog',           GES: 'General Santos',
  // Additional Asian hubs
  MFM: 'Macau',           NGO: 'Nagoya',             OKA: 'Okinawa',
  CTS: 'Sapporo',         FUK: 'Fukuoka',            KWI: 'Kuwait City',
  RUH: 'Riyadh',          JED: 'Jeddah',             MCT: 'Muscat',
  DXB: 'Dubai',           AUH: 'Abu Dhabi',
  DOH: 'Doha',            SYD: 'Sydney',             MEL: 'Melbourne',
  LHR: 'London',          LGW: 'London',             CDG: 'Paris',
  ORY: 'Paris',           FRA: 'Frankfurt',           AMS: 'Amsterdam',
  JFK: 'New York',        EWR: 'New York',           LAX: 'Los Angeles',
  SFO: 'San Francisco',   ORD: 'Chicago',            YYZ: 'Toronto',
  GUM: 'Guam',            TPE: 'Taipei',             PEK: 'Beijing',
  PKX: 'Beijing',         PVG: 'Shanghai',           SHA: 'Shanghai',
  CGK: 'Jakarta',         SGN: 'Ho Chi Minh City',   HAN: 'Hanoi',
  DEL: 'New Delhi',       BOM: 'Mumbai',             CMB: 'Colombo',
  NAN: 'Nadi',            GVA: 'Geneva',             ZRH: 'Zurich',
  BCN: 'Barcelona',       MAD: 'Madrid',             FCO: 'Rome',
  MXP: 'Milan',           IST: 'Istanbul',           NBO: 'Nairobi',
  ADD: 'Addis Ababa',     MEX: 'Mexico City',        GRU: 'São Paulo',
  EZE: 'Buenos Aires',    SCL: 'Santiago',           BOG: 'Bogotá',
};

// ── Cabin class translation keys ──────────────────────────────────────────────
const CABIN_KEYS: Record<string, string> = {
  economy:         'landing.search.cabinClass.economy',
  premium_economy: 'landing.search.cabinClass.premiumEconomy',
  business:        'landing.search.cabinClass.business',
  first:           'landing.search.cabinClass.first',
};

function getCity(iata: string | undefined): string {
  if (!iata) return '';
  return AIRPORT_CITIES[iata.toUpperCase()] ?? iata.toUpperCase();
}

/** "MNL → HKG" → "Manila (MNL) → Hong Kong (HKG)" */
function resolveRoute(title: string): string {
  const parts = title.split('→').map(s => s.trim());
  if (parts.length !== 2) return title;
  const [o, d] = parts.map(s => s.toUpperCase());
  return `${AIRPORT_CITIES[o] ?? o} (${o}) ✈ ${AIRPORT_CITIES[d] ?? d} (${d})`;
}

function isPlaceholderImage(url: string | null | undefined): boolean {
  if (!url || url.trim() === '') return true;
  const u = url.toLowerCase();
  return (
    u.includes('fastly.picsum.photos') ||
    u.includes('placeholder') ||
    u.includes('via.placeholder') ||
    u.includes('flag') ||
    u.includes('coat_of_arms') ||
    u.includes('emblem') ||
    u.includes('seal_of') ||
    u.includes('national_symbol') ||
    u.endsWith('.svg') ||
    u.includes('.svg?') ||
    u.includes('.svg/')
  );
}


/** Route deal cards directly to the book page. The book page handles passenger config + search. */
function buildBookingUrl(deal: Deal): string {
  if (!deal.origin || !deal.destination) return '/flights/search';
  const p = new URLSearchParams({
    origin:      deal.origin,
    destination: deal.destination,
    cabinClass:  deal.cabinClass || 'economy',
  });
  if (deal.salePrice)     p.set('dealPrice',         String(Math.round(deal.salePrice)));
  if (deal.originalPrice && deal.originalPrice > deal.salePrice)
                          p.set('dealOriginalPrice', String(Math.round(deal.originalPrice)));
  if (deal.currency)      p.set('dealCurrency',      deal.currency);
  if (deal.discount)      p.set('dealDiscount',      deal.discount);
  if (deal.subtitle)      p.set('dealSubtitle',      deal.subtitle);
  return `/flights/book?${p.toString()}`;
}

// ── Card ──────────────────────────────────────────────────────────────────────
interface DealCardProps {
  deal: Deal;
  index: number;
  variant?: 'carousel' | 'grid';
}

const DealCardImpl: React.FC<DealCardProps> = ({ deal, index, variant = 'carousel' }) => {
  const router     = useRouter();
  const t          = useTranslations();

  const destCity   = getCity(deal.destination);
  const imageUrl   = isPlaceholderImage(deal.image)
    ? `/api/hotel-photo?q=${encodeURIComponent(`${destCity} city travel`)}`
    : deal.image;

  const bookingUrl = buildBookingUrl(deal);
  const cabinLabel = t(CABIN_KEYS[deal.cabinClass || 'economy'] || 'landing.search.cabinClass.economy');

  const [isSaved, setIsSaved] = useState(false);

  return (
    <motion.div
      initial={index === 0 ? false : { opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => router.push(bookingUrl)}
      style={variant === 'carousel' ? { width: 'max(200px, calc((100% - 50px) / 5))' } : undefined}
      className={variant === 'grid' ? 'cursor-pointer' : 'shrink-0 snap-start cursor-pointer'}
    >
      <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 group rounded-sm">

        {/* ── Image ───────────────────────────────────────────── */}
        <div className="relative h-[148px] overflow-hidden shrink-0">
          {imageUrl
            ? <Image src={imageUrl} alt={deal.title} fill unoptimized
                sizes="(max-width: 640px) 220px, (max-width: 768px) 240px, 260px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority={index === 0} loading={index === 0 ? undefined : 'lazy'} />
            : <div className="absolute inset-0 bg-linear-to-br from-blue-900 to-slate-900" />
          }

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-b from-black/5 via-transparent to-black/75" />

          {/* Popular Route badge — top left */}
          <div className="absolute top-1.5 left-2.5 z-10">
            <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-[11px] rounded-md leading-none border border-white/30">
              {t('deals.popularRoute')}
            </span>
          </div>

          {/* Bookmark button — top right */}
          <button
            onClick={e => { e.stopPropagation(); setIsSaved(v => !v); }}
            className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
            aria-label="Save deal"
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${isSaved ? 'text-red-400 fill-red-400' : 'text-white'}`}
            />
          </button>
        </div>

        {/* ── Card body ───────────────────────────────────────── */}
        <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1 flex-1">
          {/* Route */}
          <h3 className="text-[12px] text-slate-900 dark:text-white leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {resolveRoute(deal.title)}
          </h3>

          {/* Airline */}
          {deal.subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {deal.subtitle}
            </p>
          )}

          {/* Cabin · Trip type + Book button */}
          <div className="flex items-center justify-between gap-2 mt-auto pt-2">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
             • {cabinLabel} • {deal.return_date ? t('deals.roundTrip') : t('deals.oneWay')}
            </p>
            <button
              onClick={e => { e.stopPropagation(); router.push(bookingUrl); }}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-sm transition-colors cursor-pointer leading-none"
            >
              {t('deals.searchFlights')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const DealCard = React.memo(DealCardImpl);
DealCard.displayName = 'DealCard';

// ── Location detection via browser timezone (zero API calls, zero permissions) ─
// Timezone strings are far more specific than country codes: "Asia/Manila" can
// only ever mean MNL, "Europe/Amsterdam" can only mean AMS, etc.
const TIMEZONE_TO_IATA: Record<string, string> = {
  // South-East Asia
  'Asia/Manila': 'MNL',       'Asia/Singapore': 'SIN',
  'Asia/Bangkok': 'BKK',      'Asia/Vientiane': 'VTE',
  'Asia/Phnom_Penh': 'PNH',   'Asia/Ho_Chi_Minh': 'SGN',
  'Asia/Saigon': 'SGN',       'Asia/Hanoi': 'HAN',
  'Asia/Kuala_Lumpur': 'KUL', 'Asia/Kuching': 'KUL',
  'Asia/Jakarta': 'CGK',      'Asia/Makassar': 'UPG',
  'Asia/Jayapura': 'DJJ',     'Asia/Dili': 'DIL',
  'Asia/Rangoon': 'RGN',      'Asia/Yangon': 'RGN',
  // East Asia
  'Asia/Tokyo': 'NRT',        'Asia/Seoul': 'ICN',
  'Asia/Hong_Kong': 'HKG',    'Asia/Taipei': 'TPE',
  'Asia/Shanghai': 'PVG',     'Asia/Chongqing': 'PVG',
  'Asia/Harbin': 'PEK',       'Asia/Urumqi': 'URC',
  'Asia/Macau': 'MFM',        'Asia/Ulaanbaatar': 'ULN',
  // South Asia & Middle East
  'Asia/Kolkata': 'DEL',      'Asia/Calcutta': 'DEL',
  'Asia/Mumbai': 'BOM',       'Asia/Colombo': 'CMB',
  'Asia/Dhaka': 'DAC',        'Asia/Kathmandu': 'KTM',
  'Asia/Karachi': 'KHI',      'Asia/Dubai': 'DXB',
  'Asia/Qatar': 'DOH',        'Asia/Riyadh': 'RUH',
  'Asia/Kuwait': 'KWI',       'Asia/Bahrain': 'BAH',
  'Asia/Muscat': 'MCT',       'Asia/Baghdad': 'BGW',
  'Asia/Beirut': 'BEY',       'Asia/Amman': 'AMM',
  'Asia/Jerusalem': 'TLV',    'Asia/Tel_Aviv': 'TLV',
  // Pacific & Oceania
  'Australia/Sydney': 'SYD',  'Australia/Melbourne': 'MEL',
  'Australia/Brisbane': 'BNE','Australia/Perth': 'PER',
  'Australia/Adelaide': 'ADL','Australia/Darwin': 'DRW',
  'Pacific/Auckland': 'AKL',  'Pacific/Fiji': 'NAN',
  'Pacific/Guam': 'GUM',      'Pacific/Honolulu': 'HNL',
  'Pacific/Port_Moresby': 'POM',
  // Europe
  'Europe/London': 'LHR',     'Europe/Dublin': 'DUB',
  'Europe/Paris': 'CDG',      'Europe/Berlin': 'FRA',
  'Europe/Amsterdam': 'AMS',  'Europe/Rome': 'FCO',
  'Europe/Madrid': 'MAD',     'Europe/Lisbon': 'LIS',
  'Europe/Zurich': 'ZRH',     'Europe/Geneva': 'GVA',
  'Europe/Vienna': 'VIE',     'Europe/Brussels': 'BRU',
  'Europe/Stockholm': 'ARN',  'Europe/Oslo': 'OSL',
  'Europe/Copenhagen': 'CPH', 'Europe/Helsinki': 'HEL',
  'Europe/Athens': 'ATH',     'Europe/Warsaw': 'WAW',
  'Europe/Prague': 'PRG',     'Europe/Budapest': 'BUD',
  'Europe/Bucharest': 'OTP',  'Europe/Sofia': 'SOF',
  'Europe/Istanbul': 'IST',   'Europe/Moscow': 'SVO',
  'Europe/Kyiv': 'KBP',       'Europe/Kiev': 'KBP',
  // Americas
  'America/New_York': 'JFK',  'America/Los_Angeles': 'LAX',
  'America/Chicago': 'ORD',   'America/Denver': 'DEN',
  'America/Phoenix': 'PHX',   'America/Dallas': 'DFW',
  'America/Houston': 'IAH',   'America/Atlanta': 'ATL',
  'America/Boston': 'BOS',    'America/Miami': 'MIA',
  'America/Seattle': 'SEA',   'America/San_Francisco': 'SFO',
  'America/Toronto': 'YYZ',   'America/Vancouver': 'YVR',
  'America/Montreal': 'YUL',  'America/Mexico_City': 'MEX',
  'America/Bogota': 'BOG',    'America/Lima': 'LIM',
  'America/Santiago': 'SCL',  'America/Argentina/Buenos_Aires': 'EZE',
  'America/Sao_Paulo': 'GRU', 'America/Caracas': 'CCS',
  // Africa
  'Africa/Cairo': 'CAI',      'Africa/Nairobi': 'NBO',
  'Africa/Lagos': 'LOS',      'Africa/Johannesburg': 'JNB',
  'Africa/Casablanca': 'CMN', 'Africa/Addis_Ababa': 'ADD',
  'Africa/Accra': 'ACC',      'Africa/Dar_es_Salaam': 'DAR',
};

function useUserOrigin(): { iata: string | null; city: string | null } {
  const [iata, setIata] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const code = TIMEZONE_TO_IATA[tz] ?? null;
      setIata(code);
    } catch {
      // Intl unavailable — leave null, show all deals
    }
  }, []);

  const city = iata ? (AIRPORT_CITIES[iata] ?? null) : null;
  return { iata, city };
}

// ── Section ───────────────────────────────────────────────────────────────────
interface DealsSectionProps { deals?: Deal[] }

const DealsSection: React.FC<DealsSectionProps> = ({ deals }) => {
  const t         = useTranslations();
  const rawDeals  = deals || [];
  const gridRef   = useRef<HTMLDivElement>(null);
  const { ref: rowRef, dragProps } = useDragScroll<HTMLDivElement>();
  const [showAll,    setShowAll]    = useState(false);
  const [tripType,   setTripType]   = useState<'all' | 'oneway' | 'roundtrip'>('all');


  const { iata: userOrigin, city: userCity } = useUserOrigin();

  // Sort: deals departing from the user's detected airport float to the top.
  // Falls back to the original order when no match exists in the fetched set.
  const sortedDeals = useMemo(() => {
    if (!userOrigin) return rawDeals;
    const local  = rawDeals.filter(d => d.origin === userOrigin);
    const others = rawDeals.filter(d => d.origin !== userOrigin);
    return local.length > 0 ? [...local, ...others] : rawDeals;
  }, [rawDeals, userOrigin]);

  // Filter by trip type — a deal with a return_date is a round trip.
  const displayDeals = useMemo(() => {
    if (tripType === 'all') return sortedDeals;
    return sortedDeals.filter(d =>
      tripType === 'roundtrip' ? !!d.return_date : !d.return_date
    );
  }, [sortedDeals, tripType]);

  const isPersonalized = userOrigin != null &&
    displayDeals.some(d => d.origin === userOrigin);

  return (
    <section className="w-full py-2 md:py-4 lg:py-5">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* Header */}
        <SectionHeader
          showAll={showAll}
          onToggleShowAll={() => {
            setShowAll(v => !v);
            if (!showAll) setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          }}
          title={isPersonalized
            ? t.rich('deals.headerPersonalized', { city: () => <span className="text-blue-600 dark:text-blue-400">{userCity ?? userOrigin}</span> })
            : t('deals.headerDefault')}
          subtitle={isPersonalized
            ? t('deals.subtitlePersonalized', { city: userCity ?? userOrigin })
            : t('deals.subtitleDefault')}
        >
          {/* Trip-type filter pills */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {([
              { key: 'all',       label: t('deals.all') },
              { key: 'oneway',    label: t('deals.oneWay') },
              { key: 'roundtrip', label: t('deals.roundTrip') },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTripType(key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
                  tripType === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </SectionHeader>

        {/* Horizontal scroll row */}
        <div
          ref={rowRef}
          {...dragProps}
          className="flex overflow-x-auto snap-x snap-mandatory gap-3 pt-5 pb-3 -mt-5 -mx-4 sm:-mx-6 px-4 sm:px-6 scroll-px-4 sm:scroll-px-6 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {displayDeals.map((deal, i) => (
            <DealCard key={deal.id} deal={deal} index={i} />
          ))}
        </div>

        {/* "View all" expanded grid */}
        <AnimatePresence>
          {showAll && (
            <motion.div
              ref={gridRef}
              key="all-deals-grid"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="mt-6"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {t('deals.allDealsCount', { count: displayDeals.length })}
                </p>
                <button
                  onClick={() => setShowAll(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md"
                >
                  {t('deals.collapse')}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {displayDeals.map((deal, i) => (
                  <DealCard key={deal.id} deal={deal} index={i} variant="grid" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default DealsSection;
