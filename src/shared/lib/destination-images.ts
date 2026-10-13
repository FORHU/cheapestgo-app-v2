/** Maps IATA codes and destination slugs to local static images in public/images/destinations/. */

export const IATA_TO_SLUG: Record<string, string> = {
  // Philippines
  MNL: 'manila', CEB: 'cebu', CRK: 'clark', DVO: 'davao',
  ILO: 'iloilo', KLO: 'boracay', PPS: 'puerto-princesa',
  // Japan
  NRT: 'tokyo', HND: 'tokyo', KIX: 'osaka', ITM: 'osaka',
  FUK: 'fukuoka', OKA: 'okinawa', CTS: 'sapporo', NGO: 'nagoya',
  // Korea
  ICN: 'seoul', GMP: 'seoul',
  // Southeast Asia
  SIN: 'singapore',
  BKK: 'bangkok', DMK: 'bangkok',
  KUL: 'kuala-lumpur',
  HKG: 'hong-kong',
  SGN: 'ho-chi-minh', HAN: 'hanoi',
  CGK: 'jakarta',
  // Taiwan / China
  TPE: 'taipei',
  PEK: 'beijing', PKX: 'beijing',
  PVG: 'shanghai', SHA: 'shanghai',
  MFM: 'macau',
  // Middle East
  DXB: 'dubai', AUH: 'abu-dhabi', DOH: 'doha',
  KWI: 'kuwait-city', RUH: 'riyadh', JED: 'jeddah', MCT: 'muscat',
  // Australia / Pacific
  SYD: 'sydney', MEL: 'melbourne',
  NAN: 'fiji', GUM: 'guam',
  // Europe
  LHR: 'london', LGW: 'london',
  CDG: 'paris', ORY: 'paris',
  FRA: 'frankfurt', AMS: 'amsterdam',
  BCN: 'barcelona', MAD: 'madrid',
  FCO: 'rome', MXP: 'milan',
  IST: 'istanbul',
  GVA: 'geneva', ZRH: 'zurich',
  // USA / Canada
  JFK: 'new-york', EWR: 'new-york', LGA: 'new-york',
  LAX: 'los-angeles', SFO: 'san-francisco', ORD: 'chicago',
  YYZ: 'toronto', YVR: 'vancouver',
  // South Asia
  DEL: 'new-delhi', BOM: 'mumbai', CMB: 'colombo',
  // Africa
  NBO: 'nairobi', ADD: 'nairobi',
  // Latin America
  MEX: 'mexico-city', GRU: 'sao-paulo', EZE: 'buenos-aires',
  SCL: 'santiago', BOG: 'bogota',
};

/** Returns the local static image path for an IATA code, or null if not mapped. */
export function destinationImagePath(iata: string): string | null {
  const slug = IATA_TO_SLUG[iata.toUpperCase()];
  return slug ? `/images/destinations/${slug}.jpg` : null;
}

/** Maps city/attraction names to their local static image slugs. */
export const CITY_IMAGE_SLUG: Record<string, string> = {
  // Major cities
  'Tokyo': 'tokyo', 'Paris': 'paris', 'New York': 'new-york',
  'London': 'london', 'Bangkok': 'bangkok', 'Singapore': 'singapore',
  'Seoul': 'seoul', 'Dubai': 'dubai', 'Kuala Lumpur': 'kuala-lumpur',
  'Barcelona': 'barcelona', 'Amsterdam': 'amsterdam', 'Hong Kong': 'hong-kong',
  'Los Angeles': 'los-angeles', 'Manila': 'manila', 'Cebu': 'cebu',
  'Davao': 'davao', 'Iloilo': 'iloilo', 'Clark': 'clark',
  'Osaka': 'osaka', 'Fukuoka': 'fukuoka', 'Sapporo': 'sapporo',
  'Nagoya': 'nagoya', 'Okinawa': 'okinawa',
  'Taipei': 'taipei', 'Beijing': 'beijing', 'Shanghai': 'shanghai',
  'Sydney': 'sydney', 'Melbourne': 'melbourne',
  'Abu Dhabi': 'abu-dhabi', 'Doha': 'doha', 'Kuwait City': 'kuwait-city',
  'Riyadh': 'riyadh', 'Jeddah': 'jeddah', 'Muscat': 'muscat',
  'Rome': 'rome', 'Milan': 'milan', 'Frankfurt': 'frankfurt', 'Istanbul': 'istanbul',
  'Ho Chi Minh City': 'ho-chi-minh', 'Saigon': 'ho-chi-minh',
  'Hanoi': 'hanoi', 'Jakarta': 'jakarta',
  'New Delhi': 'new-delhi', 'Delhi': 'new-delhi',
  'Mumbai': 'mumbai', 'Colombo': 'colombo',
  'San Francisco': 'san-francisco', 'Chicago': 'chicago',
  'Toronto': 'toronto', 'Vancouver': 'vancouver',
  'Geneva': 'geneva', 'Zurich': 'zurich', 'Madrid': 'madrid',
  'Nairobi': 'nairobi', 'Macau': 'macau',
  'Mexico City': 'mexico-city', 'Sao Paulo': 'sao-paulo', 'São Paulo': 'sao-paulo',
  'Buenos Aires': 'buenos-aires', 'Santiago': 'santiago', 'Bogota': 'bogota',
  'Bogotá': 'bogota', 'Fiji': 'fiji', 'Guam': 'guam',
  // Also reachable as cities in searches
  'Phuket': 'phuket', 'Bali': 'bali', 'Jeju': 'jeju-island', 'Jeju Island': 'jeju-island',
  'Maldives': 'maldives', 'Santorini': 'santorini',
};

/** Maps attraction names to their local static image slugs. */
export const ATTRACTION_IMAGE_SLUG: Record<string, string> = {
  'Eiffel Tower': 'eiffel-tower',
  'Colosseum': 'colosseum',
  'Machu Picchu': 'machu-picchu',
  'Santorini': 'santorini',
  'Bali': 'bali',
  'Angkor Wat': 'angkor-wat',
  'Safari — Serengeti': 'serengeti',
  'Grand Canyon': 'grand-canyon',
  'Boracay': 'boracay',
  'Mount Fuji': 'mount-fuji',
  'Ha Long Bay': 'ha-long-bay',
  'Taj Mahal': 'taj-mahal',
  'Phuket': 'phuket',
  'Northern Lights': 'northern-lights',
  'Pyramids of Giza': 'pyramids-of-giza',
  'Palawan': 'palawan',
  'Amalfi Coast': 'amalfi-coast',
  'Great Barrier Reef': 'great-barrier-reef',
  'Jeju Island': 'jeju-island',
  'Maldives': 'maldives',
};

export function cityImagePath(name: string): string {
  const slug = CITY_IMAGE_SLUG[name];
  return slug ? `/images/destinations/${slug}.jpg` : '/images/destinations/placeholder.jpg';
}

export function attractionImagePath(name: string): string {
  const slug = ATTRACTION_IMAGE_SLUG[name];
  return slug ? `/images/destinations/${slug}.jpg` : '/images/destinations/placeholder.jpg';
}

/**
 * Returns a local static image path for a destination name, or null if none exists.
 * Checks exact match first, then prefix match (e.g. "Phuket, Thailand" → "Phuket").
 */
export function findLocalDestinationImage(name: string): string | null {
  const exact = CITY_IMAGE_SLUG[name] ?? ATTRACTION_IMAGE_SLUG[name];
  if (exact) return `/images/destinations/${exact}.jpg`;

  const lower = name.toLowerCase();
  for (const [key, slug] of Object.entries(CITY_IMAGE_SLUG)) {
    if (lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower)) {
      return `/images/destinations/${slug}.jpg`;
    }
  }
  for (const [key, slug] of Object.entries(ATTRACTION_IMAGE_SLUG)) {
    if (lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower)) {
      return `/images/destinations/${slug}.jpg`;
    }
  }
  return null;
}
