/**
 * TravelgateX hotel search — core logic, no HTTP layer.
 * Called directly by server routes to avoid HTTP self-call overhead.
 */

import { tgxGraphQL, getTgxSettings, getTgxConfig, getTgxFilterSearch, buildOccupancies, normalizeOption, type TgxOption } from './client';
import { getSqlAdmin } from '@/server/db/postgres';
import { resolveTgxDestinationCode, backgroundResolveDestCode, type DestinationRung } from '@/server/search';
import { otvCodeToLabel } from './amenityCodes';

// ─── Country bounding boxes for geographic hotel filtering ───────────────────
const COUNTRY_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
    TH: { minLat: 3.6,   maxLat: 22.5,  minLng: 95.3,   maxLng: 107.7  },
    ID: { minLat: -13.0, maxLat: 7.9,   minLng: 93.0,   maxLng: 143.0  },
    JP: { minLat: 22.0,  maxLat: 47.5,  minLng: 120.9,  maxLng: 147.8  },
    PH: { minLat: 4.6,   maxLat: 21.1,  minLng: 116.9,  maxLng: 128.0  },
    SG: { minLat: 1.1,   maxLat: 1.6,   minLng: 103.6,  maxLng: 104.1  },
    MY: { minLat: -0.2,  maxLat: 8.5,   minLng: 99.6,   maxLng: 119.5  },
    VN: { minLat: 8.2,   maxLat: 23.4,  minLng: 102.1,  maxLng: 109.5  },
    KH: { minLat: 9.4,   maxLat: 14.7,  minLng: 102.3,  maxLng: 107.6  },
    LA: { minLat: 13.9,  maxLat: 22.5,  minLng: 100.1,  maxLng: 107.7  },
    MM: { minLat: 9.8,   maxLat: 28.5,  minLng: 92.2,   maxLng: 101.2  },
    BN: { minLat: 4.0,   maxLat: 5.1,   minLng: 114.1,  maxLng: 115.4  },
    TL: { minLat: -9.5,  maxLat: -8.1,  minLng: 124.0,  maxLng: 127.3  },
    IN: { minLat: 6.7,   maxLat: 37.1,  minLng: 68.2,   maxLng: 97.4   },
    PK: { minLat: 23.6,  maxLat: 37.1,  minLng: 60.9,   maxLng: 77.1   },
    BD: { minLat: 20.7,  maxLat: 26.6,  minLng: 88.0,   maxLng: 92.7   },
    LK: { minLat: 5.9,   maxLat: 9.8,   minLng: 79.7,   maxLng: 81.9   },
    NP: { minLat: 26.3,  maxLat: 30.4,  minLng: 80.1,   maxLng: 88.2   },
    BT: { minLat: 26.7,  maxLat: 28.3,  minLng: 88.8,   maxLng: 92.1   },
    MV: { minLat: -1.0,  maxLat: 7.1,   minLng: 72.7,   maxLng: 73.8   },
    AF: { minLat: 29.4,  maxLat: 38.5,  minLng: 60.5,   maxLng: 74.9   },
    CN: { minLat: 18.2,  maxLat: 53.6,  minLng: 73.5,   maxLng: 134.8  },
    HK: { minLat: 22.1,  maxLat: 22.6,  minLng: 113.8,  maxLng: 114.5  },
    MO: { minLat: 22.1,  maxLat: 22.2,  minLng: 113.5,  maxLng: 113.6  },
    TW: { minLat: 21.9,  maxLat: 25.3,  minLng: 119.9,  maxLng: 122.1  },
    KR: { minLat: 33.1,  maxLat: 38.6,  minLng: 125.1,  maxLng: 130.9  },
    KP: { minLat: 37.7,  maxLat: 42.5,  minLng: 124.3,  maxLng: 130.7  },
    MN: { minLat: 41.6,  maxLat: 52.1,  minLng: 87.8,   maxLng: 119.9  },
    AU: { minLat: -43.7, maxLat: -10.7, minLng: 113.2,  maxLng: 153.6  },
    NZ: { minLat: -47.3, maxLat: -34.4, minLng: 166.4,  maxLng: 178.6  },
    PG: { minLat: -11.7, maxLat: -1.3,  minLng: 141.0,  maxLng: 155.7  },
    SB: { minLat: -11.9, maxLat: -5.0,  minLng: 155.5,  maxLng: 166.9  },
    VU: { minLat: -20.3, maxLat: -13.1, minLng: 166.5,  maxLng: 170.2  },
    FJ: { minLat: -20.7, maxLat: -12.5, minLng: 177.0,  maxLng: 180.0  },
    WS: { minLat: -14.1, maxLat: -13.4, minLng: -172.8, maxLng: -171.4 },
    TO: { minLat: -22.4, maxLat: -15.6, minLng: -175.4, maxLng: -173.7 },
    FM: { minLat: 1.0,   maxLat: 10.1,  minLng: 138.0,  maxLng: 163.1  },
    PW: { minLat: 2.8,   maxLat: 8.1,   minLng: 131.1,  maxLng: 134.7  },
    MH: { minLat: 4.6,   maxLat: 14.7,  minLng: 160.8,  maxLng: 172.0  },
    AE: { minLat: 22.6,  maxLat: 26.1,  minLng: 51.6,   maxLng: 56.4   },
    SA: { minLat: 16.4,  maxLat: 32.2,  minLng: 36.5,   maxLng: 55.7   },
    QA: { minLat: 24.5,  maxLat: 26.2,  minLng: 50.7,   maxLng: 51.7   },
    BH: { minLat: 25.8,  maxLat: 26.4,  minLng: 50.3,   maxLng: 50.8   },
    KW: { minLat: 28.5,  maxLat: 30.1,  minLng: 46.5,   maxLng: 48.4   },
    OM: { minLat: 16.6,  maxLat: 26.4,  minLng: 51.9,   maxLng: 59.9   },
    YE: { minLat: 12.1,  maxLat: 19.0,  minLng: 42.6,   maxLng: 54.7   },
    JO: { minLat: 29.2,  maxLat: 33.4,  minLng: 34.9,   maxLng: 39.3   },
    IL: { minLat: 29.5,  maxLat: 33.3,  minLng: 34.3,   maxLng: 35.9   },
    PS: { minLat: 31.2,  maxLat: 32.6,  minLng: 34.2,   maxLng: 35.6   },
    LB: { minLat: 33.1,  maxLat: 34.7,  minLng: 35.1,   maxLng: 36.6   },
    SY: { minLat: 32.3,  maxLat: 37.3,  minLng: 35.7,   maxLng: 42.4   },
    IQ: { minLat: 29.1,  maxLat: 37.4,  minLng: 38.8,   maxLng: 48.6   },
    IR: { minLat: 25.1,  maxLat: 39.8,  minLng: 44.0,   maxLng: 63.3   },
    KZ: { minLat: 40.6,  maxLat: 55.4,  minLng: 50.3,   maxLng: 87.4   },
    UZ: { minLat: 37.2,  maxLat: 45.6,  minLng: 56.0,   maxLng: 73.2   },
    TM: { minLat: 35.1,  maxLat: 42.8,  minLng: 52.5,   maxLng: 66.7   },
    TJ: { minLat: 36.7,  maxLat: 41.0,  minLng: 67.4,   maxLng: 75.2   },
    KG: { minLat: 39.2,  maxLat: 43.2,  minLng: 69.3,   maxLng: 80.3   },
    GE: { minLat: 41.0,  maxLat: 43.6,  minLng: 40.0,   maxLng: 46.7   },
    AM: { minLat: 38.8,  maxLat: 41.3,  minLng: 43.4,   maxLng: 46.6   },
    AZ: { minLat: 38.4,  maxLat: 41.9,  minLng: 44.8,   maxLng: 50.4   },
    RU: { minLat: 41.2,  maxLat: 81.9,  minLng: 19.6,   maxLng: 180.0  },
    UA: { minLat: 44.4,  maxLat: 52.4,  minLng: 22.1,   maxLng: 40.2   },
    BY: { minLat: 51.3,  maxLat: 56.2,  minLng: 23.2,   maxLng: 32.8   },
    MD: { minLat: 45.5,  maxLat: 48.5,  minLng: 26.6,   maxLng: 30.2   },
    RO: { minLat: 43.6,  maxLat: 48.3,  minLng: 20.3,   maxLng: 29.7   },
    BG: { minLat: 41.2,  maxLat: 44.2,  minLng: 22.4,   maxLng: 28.6   },
    RS: { minLat: 42.2,  maxLat: 46.2,  minLng: 18.8,   maxLng: 23.0   },
    XK: { minLat: 41.9,  maxLat: 43.3,  minLng: 20.0,   maxLng: 21.8   },
    BA: { minLat: 42.6,  maxLat: 45.3,  minLng: 15.7,   maxLng: 19.6   },
    ME: { minLat: 41.9,  maxLat: 43.6,  minLng: 18.5,   maxLng: 20.4   },
    HR: { minLat: 42.4,  maxLat: 46.6,  minLng: 13.5,   maxLng: 19.4   },
    SI: { minLat: 45.4,  maxLat: 46.9,  minLng: 13.4,   maxLng: 16.6   },
    MK: { minLat: 40.9,  maxLat: 42.4,  minLng: 20.5,   maxLng: 23.0   },
    AL: { minLat: 39.6,  maxLat: 42.7,  minLng: 19.3,   maxLng: 21.1   },
    SK: { minLat: 47.7,  maxLat: 49.6,  minLng: 16.8,   maxLng: 22.6   },
    PL: { minLat: 49.0,  maxLat: 54.8,  minLng: 14.1,   maxLng: 24.1   },
    CZ: { minLat: 48.5,  maxLat: 51.1,  minLng: 12.1,   maxLng: 18.9   },
    HU: { minLat: 45.7,  maxLat: 48.6,  minLng: 16.1,   maxLng: 22.9   },
    EE: { minLat: 57.5,  maxLat: 59.7,  minLng: 21.8,   maxLng: 28.2   },
    LV: { minLat: 55.7,  maxLat: 58.1,  minLng: 21.0,   maxLng: 28.2   },
    LT: { minLat: 53.9,  maxLat: 56.5,  minLng: 20.9,   maxLng: 26.8   },
    GB: { minLat: 49.9,  maxLat: 60.8,  minLng: -8.6,   maxLng: 1.8    },
    IE: { minLat: 51.4,  maxLat: 55.4,  minLng: -10.5,  maxLng: -6.0   },
    NO: { minLat: 57.9,  maxLat: 71.2,  minLng: 4.5,    maxLng: 31.1   },
    SE: { minLat: 55.3,  maxLat: 69.1,  minLng: 10.6,   maxLng: 24.2   },
    DK: { minLat: 54.6,  maxLat: 57.8,  minLng: 8.1,    maxLng: 15.2   },
    FI: { minLat: 59.8,  maxLat: 70.1,  minLng: 19.1,   maxLng: 31.6   },
    IS: { minLat: 63.3,  maxLat: 66.6,  minLng: -24.5,  maxLng: -13.5  },
    DE: { minLat: 47.3,  maxLat: 55.1,  minLng: 5.9,    maxLng: 15.0   },
    NL: { minLat: 50.7,  maxLat: 53.6,  minLng: 3.3,    maxLng: 7.3    },
    BE: { minLat: 49.5,  maxLat: 51.5,  minLng: 2.5,    maxLng: 6.4    },
    LU: { minLat: 49.4,  maxLat: 50.2,  minLng: 5.7,    maxLng: 6.5    },
    FR: { minLat: 41.3,  maxLat: 51.1,  minLng: -5.2,   maxLng: 9.6    },
    CH: { minLat: 45.8,  maxLat: 47.8,  minLng: 5.9,    maxLng: 10.5   },
    AT: { minLat: 46.4,  maxLat: 49.0,  minLng: 9.5,    maxLng: 17.2   },
    LI: { minLat: 47.0,  maxLat: 47.3,  minLng: 9.5,    maxLng: 9.6    },
    ES: { minLat: 27.6,  maxLat: 43.8,  minLng: -18.2,  maxLng: 4.3    },
    PT: { minLat: 29.8,  maxLat: 42.2,  minLng: -31.3,  maxLng: -6.2   },
    IT: { minLat: 36.6,  maxLat: 47.1,  minLng: 6.7,    maxLng: 18.5   },
    MT: { minLat: 35.8,  maxLat: 36.1,  minLng: 14.2,   maxLng: 14.6   },
    GR: { minLat: 34.8,  maxLat: 41.8,  minLng: 19.4,   maxLng: 29.6   },
    CY: { minLat: 34.6,  maxLat: 35.7,  minLng: 32.3,   maxLng: 34.6   },
    TR: { minLat: 35.8,  maxLat: 42.1,  minLng: 25.7,   maxLng: 44.8   },
    AD: { minLat: 42.4,  maxLat: 42.7,  minLng: 1.4,    maxLng: 1.8    },
    SM: { minLat: 43.9,  maxLat: 44.0,  minLng: 12.4,   maxLng: 12.5   },
    MA: { minLat: 27.7,  maxLat: 35.9,  minLng: -13.2,  maxLng: -1.0   },
    DZ: { minLat: 18.9,  maxLat: 37.1,  minLng: -8.7,   maxLng: 12.0   },
    TN: { minLat: 30.2,  maxLat: 37.5,  minLng: 7.5,    maxLng: 11.6   },
    LY: { minLat: 19.5,  maxLat: 33.2,  minLng: 9.4,    maxLng: 25.2   },
    EG: { minLat: 22.0,  maxLat: 31.7,  minLng: 24.7,   maxLng: 37.0   },
    SD: { minLat: 9.3,   maxLat: 22.2,  minLng: 21.9,   maxLng: 38.6   },
    NG: { minLat: 4.3,   maxLat: 13.9,  minLng: 2.7,    maxLng: 14.7   },
    GH: { minLat: 4.7,   maxLat: 11.2,  minLng: -3.3,   maxLng: 1.2    },
    KE: { minLat: -4.7,  maxLat: 4.6,   minLng: 33.9,   maxLng: 41.9   },
    TZ: { minLat: -11.7, maxLat: -1.0,  minLng: 29.3,   maxLng: 40.4   },
    ZA: { minLat: -34.8, maxLat: -22.1, minLng: 16.5,   maxLng: 32.9   },
    MG: { minLat: -25.6, maxLat: -11.9, minLng: 43.2,   maxLng: 50.5   },
    CA: { minLat: 41.7,  maxLat: 83.1,  minLng: -141.0, maxLng: -52.6  },
    US: { minLat: 18.9,  maxLat: 71.4,  minLng: -179.1, maxLng: -66.9  },
    MX: { minLat: 14.5,  maxLat: 32.7,  minLng: -117.1, maxLng: -86.7  },
    GT: { minLat: 13.7,  maxLat: 17.8,  minLng: -92.2,  maxLng: -88.2  },
    CO: { minLat: -4.2,  maxLat: 12.5,  minLng: -79.0,  maxLng: -66.8  },
    VE: { minLat: 0.6,   maxLat: 12.5,  minLng: -73.4,  maxLng: -59.8  },
    BR: { minLat: -33.8, maxLat: 5.3,   minLng: -73.9,  maxLng: -34.8  },
    PE: { minLat: -18.3, maxLat: -0.0,  minLng: -81.4,  maxLng: -68.7  },
    AR: { minLat: -55.1, maxLat: -21.8, minLng: -73.6,  maxLng: -53.6  },
    CL: { minLat: -55.9, maxLat: -17.5, minLng: -75.7,  maxLng: -66.4  },
};

// ─── TGX hotel content ────────────────────────────────────────────────────────

export interface TgxHotelContent {
    hotel_id:              string;
    name:                  string | null;
    images:                string[];
    lat:                   number;
    lng:                   number;
    address:               string | null;
    city:                  string | null;
    country:               string | null;
    description:           string | null;
    star_rating:           number;
    amenities:             string[];
    amenity_groups:        any[] | null;
    check_in_time:         string | null;
    check_out_time:        string | null;
    important_information: string | null;
    contact_info:          { email?: string; phone?: string; fax?: string; web?: string } | null;
    chain_code:            string | null;
    giata_id:              string | null;
    _otvCity:              string | null;
}

const HOTEL_DATA_FIELDS = `
    code
    hotelName
    categoryCode
    chainCode
    descriptions { type texts { language text } }
    medias { url type order }
    location {
        coordinates { latitude longitude }
        address
        city
        country
        zipCode
    }
    contact { email telephone fax web }
    allAmenities { edges { node { amenityData { amenityCode type } } } }
    checkIn { schedule { startTime endTime } minAge instructions { language text } specialInstructions { language text } }
    checkOut { schedule { startTime endTime } minAge instructions { language text } specialInstructions { language text } }
    giataData { id }
`;

const TGX_HOTEL_CONTENT_QUERY = `
query TgxHotelContent($criteria: HotelXHotelListInput!, $token: String) {
  hotelX {
    hotels(criteria: $criteria, token: $token) {
      token
      edges { node { hotelData { ${HOTEL_DATA_FIELDS} } } }
    }
  }
}`;

const TGX_ROOMS_CATALOG_QUERY = `
query TgxRoomsCatalog($criteria: HotelXRoomQueryInput!, $token: String) {
  hotelX {
    rooms(criteria: $criteria, token: $token) {
      token
      edges {
        node {
          roomData {
            code
            medias { url type }
          }
        }
      }
    }
  }
}`;

function parseTgxHotelData(d: any, cityName?: string, countryCode?: string): TgxHotelContent {
    const images: string[] = (d.medias ?? [])
        .sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99))
        .map((m: any) => m.url as string)
        .filter(Boolean)
        .slice(0, 10);

    let description: string | null = null;
    const extraDescs: string[] = [];
    for (const desc of (d.descriptions ?? [])) {
        const en = (desc.texts ?? []).find((t: any) => t.language?.toLowerCase().startsWith('en'));
        const text = en?.text ?? desc.texts?.[0]?.text ?? null;
        if (!text) continue;
        if (desc.type === 'GENERAL' && !description) description = text;
        else if (text && desc.type !== 'GENERAL') extraDescs.push(text);
    }
    if (!description && extraDescs.length) { description = extraDescs.shift() ?? null; }

    const catCode: string = d.categoryCode ?? '';
    const starMatch = catCode.match(/(\d)/);
    const rawCountry = d.location?.country;
    const otvCountry: string | null = typeof rawCountry === 'string' ? rawCountry : (rawCountry?.code ?? null);
    const otvCity: string | null = (d.location?.city as string | null) ?? null;

    const amenityEdges: any[] = d.allAmenities?.edges ?? [];
    const amenities = amenityEdges
        .map((e: any) => otvCodeToLabel(e?.node?.amenityData?.amenityCode ?? ''))
        .filter(Boolean);
    const amenity_groups: any[] | null = amenityEdges.length > 0
        ? amenityEdges.map((e: any) => ({
            code: e?.node?.amenityData?.amenityCode,
            type: e?.node?.amenityData?.type,
        })).filter((g: any) => g.code)
        : null;

    const checkInInstruction = (d.checkIn?.instructions ?? []).find((t: any) => t.language?.toLowerCase().startsWith('en'))?.text
        ?? d.checkIn?.instructions?.[0]?.text ?? null;
    const check_in_time: string | null = d.checkIn?.schedule?.startTime ?? checkInInstruction ?? null;

    const checkOutInstruction = (d.checkOut?.instructions ?? []).find((t: any) => t.language?.toLowerCase().startsWith('en'))?.text
        ?? d.checkOut?.instructions?.[0]?.text ?? null;
    const check_out_time: string | null = d.checkOut?.schedule?.startTime ?? checkOutInstruction ?? null;

    const specialIn = (d.checkIn?.specialInstructions ?? []).find((t: any) => t.language?.toLowerCase().startsWith('en'))?.text
        ?? d.checkIn?.specialInstructions?.[0]?.text ?? null;
    if (specialIn && !extraDescs.includes(specialIn)) extraDescs.push(specialIn);
    const important_information = extraDescs.length ? extraDescs.join('\n\n') : null;

    const c = d.contact;
    const contact_info = c && (c.email || c.telephone || c.fax || c.web) ? {
        email: c.email   ?? undefined,
        phone: c.telephone ?? undefined,
        fax:   c.fax     ?? undefined,
        web:   c.web     ?? undefined,
    } : null;

    return {
        hotel_id:    String(d.code),
        name:        (d.hotelName as string | null) ?? null,
        images,
        lat:         Number(d.location?.coordinates?.latitude  ?? 0),
        lng:         Number(d.location?.coordinates?.longitude ?? 0),
        address:     (d.location?.address as string | null) ?? null,
        city:        otvCity ?? cityName ?? null,
        country:     otvCountry ?? countryCode ?? null,
        description,
        star_rating: starMatch ? parseInt(starMatch[1], 10) : 0,
        amenities,
        amenity_groups,
        check_in_time,
        check_out_time,
        important_information,
        contact_info,
        chain_code:  (d.chainCode as string | null) ?? null,
        giata_id:    (d.giataData?.id as string | null) ?? null,
        _otvCity:    otvCity,
    };
}

export async function fetchTgxHotelContent(hotelIds: string[]): Promise<Map<string, TgxHotelContent>> {
    const contentMap = new Map<string, TgxHotelContent>();
    if (!hotelIds.length) return contentMap;
    const cfg = getTgxConfig();
    const BATCH = 50;
    for (let i = 0; i < hotelIds.length; i += BATCH) {
        const batch = hotelIds.slice(i, i + BATCH);
        try {
            const result = await tgxGraphQL(TGX_HOTEL_CONTENT_QUERY, {
                criteria: { access: cfg.accessCode, hotelCodes: batch },
            }, 15_000);
            const edges: any[] = result?.data?.hotelX?.hotels?.edges ?? [];
            for (const edge of edges) {
                const d = edge?.node?.hotelData;
                if (!d?.code) continue;
                contentMap.set(String(d.code), parseTgxHotelData(d));
            }
        } catch (e: any) {
            console.warn('[tgx-content] fetchTgxHotelContent failed:', e.message?.slice(0, 100));
        }
    }
    return contentMap;
}

// ─── TGX Rooms static catalog ─────────────────────────────────────────────────

function matchEtgRoomGroup(
    description: string,
    groups: Array<{ name: string; images: string[] }>,
): string[] {
    const withPhotos = groups.filter(g => (g.images?.length ?? 0) > 0);
    if (!withPhotos.length) return [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const desc = norm(description.replace(/\([^)]*\)/g, ''));
    const richest = (candidates: typeof withPhotos) =>
        candidates.reduce((a, b) => ((b.images?.length ?? 0) > (a.images?.length ?? 0) ? b : a));

    const exactOrPrefix = withPhotos.filter(g => {
        const gn = norm(g.name);
        return gn === desc || desc.startsWith(gn) || gn.startsWith(desc);
    });
    if (exactOrPrefix.length) return richest(exactOrPrefix).images;

    const BED_TYPES = new Set(['twin', 'single', 'triple', 'quadruple', 'quintuple', 'sextuple', 'suite', 'villa', 'loft', 'cottage', 'bungalow', 'dormitory']);
    const TIER_WORDS = new Set(['deluxe', 'standard', 'superior', 'executive', 'premium', 'premier', 'luxury']);
    const words = desc.split(' ');
    const bedWord  = words.find(w => BED_TYPES.has(w));
    const tierWord = words.find(w => TIER_WORDS.has(w));
    if (bedWord) {
        const byBed = withPhotos.filter(g => norm(g.name).includes(bedWord));
        if (tierWord && byBed.length > 1) {
            const byBoth = byBed.filter(g => norm(g.name).includes(tierWord));
            if (byBoth.length) return richest(byBoth).images;
        }
        if (byBed.length) return richest(byBed).images;
    }

    const keyWord = tierWord ?? words.find(w => w.length > 4) ?? words[0];
    if (keyWord) {
        const byKey = withPhotos.filter(g => norm(g.name).includes(keyWord));
        if (byKey.length) return richest(byKey).images;
    }
    return [];
}

async function fetchTgxRoomCatalog(
    hotelId: string,
    roomCodes: string[],
    descMap?: Map<string, string>,
): Promise<Map<string, string[]>> {
    const photoMap = new Map<string, string[]>();
    if (!hotelId || !roomCodes.length) return photoMap;

    try {
        const sql = getSqlAdmin();
        const rows = await sql<{ room_groups: any }[]>`
            SELECT room_groups FROM hotel_content
            WHERE hotel_id = ${hotelId} AND room_groups IS NOT NULL
            LIMIT 1
        `;
        if (rows[0] !== undefined) {
            const raw = rows[0]?.room_groups;
            if (Array.isArray(raw) && raw.length > 0 && descMap?.size) {
                for (const [code, desc] of descMap) {
                    const photos = matchEtgRoomGroup(desc, raw as Array<{ name: string; images: string[] }>);
                    if (photos.length) photoMap.set(code, photos);
                }
                if (photoMap.size) console.log(`[tgx-rooms] ETG match for hotel ${hotelId}: ${photoMap.size}/${descMap.size} with photos`);
            } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                const groups = raw as Record<string, { photos?: string[] }>;
                for (const code of roomCodes) {
                    const entry = groups[code];
                    if (entry?.photos?.length) photoMap.set(code, entry.photos);
                }
                if (photoMap.size) console.log(`[tgx-rooms] Cache hit for hotel ${hotelId}: ${photoMap.size}/${roomCodes.length} with photos`);
            }
            return photoMap;
        }
    } catch (e: any) {
        console.warn('[tgx-rooms] DB cache check failed:', e.message?.slice(0, 80));
    }

    const cfg = getTgxConfig();
    const catalogData: Record<string, { photos: string[] }> = {};
    try {
        const result = await tgxGraphQL(TGX_ROOMS_CATALOG_QUERY, {
            criteria: { access: cfg.accessCode, roomCodes },
        }, 10_000);
        const edges: any[] = result?.data?.hotelX?.rooms?.edges ?? [];
        for (const edge of edges) {
            const rd = edge?.node?.roomData;
            const roomCode = rd?.roomCode || rd?.code || edge?.node?.code;
            if (!roomCode) continue;
            const photos = (rd?.medias ?? [])
                .filter((m: any) => m?.url)
                .map((m: any) => String(m.url))
                .slice(0, 5);
            catalogData[roomCode] = { photos };
            if (photos.length) photoMap.set(roomCode, photos);
        }
        console.log(`[tgx-rooms] Fetched catalog for hotel ${hotelId}: ${edges.length} rooms, ${photoMap.size} with photos`);
    } catch (e: any) {
        console.warn('[tgx-rooms] hotelX.rooms query failed:', e.message?.slice(0, 100));
        return photoMap;
    }

    const adminSql = getSqlAdmin();
    adminSql`
        UPDATE hotel_content
        SET room_groups = ${adminSql.json(catalogData)}
        WHERE hotel_id = ${hotelId}
    `.catch((e: any) => console.warn('[tgx-rooms] room_groups write failed:', e.message?.slice(0, 80)));

    return photoMap;
}

// ─── ETG (RateHawk/WorldOTA) hotel content lookup ────────────────────────────

interface EtgHotelContent { name?: string; description?: string; amenities?: string[] }

const ETG_FILTER_TO_LABEL: Record<string, string> = {
    has_internet:             'Free WiFi',
    has_parking:              'Parking',
    has_pool:                 'Swimming Pool',
    has_gym:                  'Gym',
    has_meal:                 'Restaurant',
    has_breakfast:            'Breakfast Included',
    has_pets:                 'Pets Allowed',
    has_airport_transfer:     'Airport Shuttle',
    has_laundry:              'Laundry Service',
    has_spa:                  'Spa',
    has_bar:                  'Bar',
    has_casino:               'Casino',
    has_beach:                'Beach Access',
    has_tennis:               'Tennis Court',
    has_air_conditioner:      'Air Conditioning',
    has_conference_hall:      'Conference Room',
    has_ski:                  'Ski-in/Ski-out',
    has_jacuzzi:              'Jacuzzi',
    has_disability_friendly:  'Accessible',
    has_children_facilities:  'Kids Facilities',
    has_kitchen:              'Kitchen',
    has_safe:                 'Safe',
    has_sauna:                'Sauna',
};

export async function fetchEtgHotelContent(hotelIds: string[]): Promise<Map<string, EtgHotelContent>> {
    const contentMap = new Map<string, EtgHotelContent>();
    if (!hotelIds.length) return contentMap;
    const keyId  = process.env.ETG_KEY_ID;
    const apiKey = process.env.ETG_API_KEY;
    if (!keyId || !apiKey) return contentMap;
    const token = Buffer.from(`${keyId}:${apiKey}`).toString('base64');
    const BATCH = 500;
    for (let i = 0; i < hotelIds.length; i += BATCH) {
        const batch = hotelIds.slice(i, i + BATCH);
        try {
            const abort = new AbortController();
            const timeout = setTimeout(() => abort.abort(), 5_000);
            const res = await fetch('https://api.worldota.net/api/b2b/v3/hotel/info/', {
                method: 'POST',
                headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: batch, language: 'en' }),
                signal: abort.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) { console.warn(`[tgx-search] ETG hotel/info ${res.status}`); continue; }
            const json = await res.json();
            const hotels: any[] = json?.data?.hotels ?? json?.hotels ?? [];
            for (const h of hotels) {
                const id = String(h.id ?? h.hotel_id ?? '');
                if (!id) continue;
                const entry: EtgHotelContent = {};
                const name = (h.name ?? h.title ?? '') as string;
                if (name) entry.name = name;
                const descStruct: any[] = h.description_struct ?? [];
                if (descStruct.length > 0) {
                    const paragraphs = descStruct.flatMap((s: any) => (s.paragraphs ?? []) as string[]).filter(Boolean);
                    if (paragraphs.length > 0) entry.description = paragraphs.join('\n\n');
                }
                const filters: string[] = h.serp_filters ?? [];
                const amenities = filters.map((f: string) => ETG_FILTER_TO_LABEL[f]).filter(Boolean);
                if (amenities.length > 0) entry.amenities = amenities;
                if (Object.keys(entry).length > 0) contentMap.set(id, entry);
            }
        } catch (e: any) {
            if ((e as any)?.name !== 'AbortError') console.warn('[tgx-search] ETG hotel/info batch failed:', e.message);
        }
    }
    console.log(`[tgx-search] ETG hotel/info enriched ${contentMap.size}/${hotelIds.length} hotels`);
    return contentMap;
}

export async function updateEtgContentInDb(etgMap: Map<string, EtgHotelContent>): Promise<void> {
    if (!etgMap.size) return;
    const sql = getSqlAdmin();
    let saved = 0;
    for (const [hotelId, content] of etgMap) {
        try {
            await sql`
                INSERT INTO hotel_content (hotel_id, name, images, description, amenities, content_source, fetched_at)
                VALUES (
                    ${hotelId}, ${content.name ?? null}, '{}',
                    ${content.description ?? null},
                    ${content.amenities ? JSON.stringify(content.amenities) : '[]'}::jsonb,
                    'etg', now()
                )
                ON CONFLICT (hotel_id) DO UPDATE SET
                    name        = CASE WHEN hotel_content.name IS NULL OR hotel_content.name = hotel_content.hotel_id
                                  THEN COALESCE(EXCLUDED.name, hotel_content.name) ELSE hotel_content.name END,
                    description = CASE WHEN (hotel_content.description IS NULL OR hotel_content.description = '')
                                       AND EXCLUDED.description IS NOT NULL
                                  THEN EXCLUDED.description ELSE hotel_content.description END,
                    amenities   = CASE WHEN (hotel_content.amenities IS NULL OR jsonb_typeof(hotel_content.amenities) != 'array' OR jsonb_array_length(hotel_content.amenities) = 0)
                                       AND (EXCLUDED.amenities IS NOT NULL AND jsonb_typeof(EXCLUDED.amenities) = 'array' AND jsonb_array_length(EXCLUDED.amenities) > 0)
                                  THEN EXCLUDED.amenities ELSE hotel_content.amenities END,
                    fetched_at  = now()
            `;
            saved++;
        } catch { /* skip individual failures */ }
    }
    if (saved) console.log(`[tgx-search] Upserted ETG content for ${saved} hotels into hotel_content`);
}

function getEtgToken(): string {
    const keyId  = process.env.ETG_KEY_ID  ?? '';
    const apiKey = process.env.ETG_API_KEY ?? '';
    return Buffer.from(`${keyId}:${apiKey}`).toString('base64');
}

async function backgroundSeedEtgContent(hotelId: string, hotelName: string): Promise<void> {
    try {
        const token = getEtgToken();
        const mcRes = await fetch('https://api.worldota.net/api/b2b/v3/search/multicomplete/', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: hotelName, language: 'en' }),
            signal: AbortSignal.timeout(8_000),
        });
        if (!mcRes.ok) return;
        const mcJson = await mcRes.json();
        const hotels: any[] = mcJson?.data?.hotels ?? [];
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const match = hotels.find(h => norm(h.name ?? '') === norm(hotelName));
        if (!match?.id) return;
        const hid: string = match.id;

        const infoRes = await fetch('https://api.worldota.net/api/b2b/v3/hotel/info/', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: hid, language: 'en' }),
            signal: AbortSignal.timeout(12_000),
        });
        if (!infoRes.ok) return;
        const infoJson = await infoRes.json();
        const data = infoJson?.data;
        if (!data) return;

        const resolveUrl = (u: unknown) => typeof u === 'string' ? u.replace(/\{size\}/g, '1024x768') : null;
        const hotelImages: string[] = (data.images ?? [])
            .map((img: any) => resolveUrl(typeof img === 'string' ? img : (img?.url ?? img?.src)))
            .filter((u: string | null): u is string => Boolean(u))
            .slice(0, 20);

        const roomGroups = (data.room_groups ?? [])
            .map((rg: any) => ({
                name: rg.name ?? '',
                images: (rg.images ?? [])
                    .map((img: any) => resolveUrl(typeof img === 'string' ? img : (img?.url ?? img?.src)))
                    .filter((u: string | null): u is string => Boolean(u))
                    .slice(0, 10),
            }))
            .filter((rg: { name: string; images: string[] }) => rg.name);

        const sql = getSqlAdmin();
        const imgLiteral = '{' + hotelImages.map(u => '"' + u.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}';
        await sql`
            UPDATE hotel_content
            SET ratehawk_hid          = ${hid},
                images                = ${imgLiteral}::text[],
                room_groups           = ${sql.json(roomGroups)},
                room_groups_seeded_at = NOW()
            WHERE hotel_id = ${hotelId}
              AND ratehawk_hid IS NULL
        `;
        console.log(`[etg-bg-seed] ${hotelId} (${hotelName}) → ${hid}: ${hotelImages.length} imgs, ${roomGroups.length} room groups`);
        await sql`DELETE FROM hotel_search_cache WHERE cache_key LIKE ${'hotel:' + hotelId + '|%'}`;
    } catch (e: any) {
        console.warn(`[etg-bg-seed] ${hotelId}: ${e.message?.slice(0, 80)}`);
    }
}

const AREA_TYPES = new Set([
    'Province (State)',
    'Region',
    'Multi-City (Vicinity)',
    'Multi-Region (within a country)',
]);
const isCity    = (r: any) => r?.type === 'City';
const isArea    = (r: any) => AREA_TYPES.has(r?.type);
const isCountry = (r: any) => r?.type === 'Country';

const TYPE_PRIORITY: Record<DestinationRung, Array<(r: any) => boolean>> = {
    country:  [isCountry, isArea],
    province: [isArea, isCity],
    city:     [isCity, isArea],
    district: [isCity, isArea],
    poi:      [isCity, isArea],
};

function findBestMatch(
    regions: any[],
    typeChecks: Array<(r: any) => boolean>,
    nameMatches: (r: any) => boolean,
    inCountry: (r: any) => boolean,
): any {
    for (const isType of typeChecks) {
        const match =
            regions.find((r: any) => isType(r) && nameMatches(r) && inCountry(r)) ??
            regions.find((r: any) => isType(r) && nameMatches(r));
        if (match) return match;
    }
    return undefined;
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
    'indonesia': 'ID', 'france': 'FR', 'italy': 'IT', 'spain': 'ES', 'germany': 'DE',
    'japan': 'JP', 'thailand': 'TH', 'greece': 'GR', 'united states': 'US', 'usa': 'US',
    'australia': 'AU', 'philippines': 'PH', 'south korea': 'KR', 'korea': 'KR',
    'vietnam': 'VN', 'cambodia': 'KH', 'singapore': 'SG', 'malaysia': 'MY',
    'india': 'IN', 'china': 'CN', 'hong kong': 'HK', 'taiwan': 'TW',
    'peru': 'PE', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR',
    'egypt': 'EG', 'tanzania': 'TZ', 'south africa': 'ZA', 'kenya': 'KE',
    'iceland': 'IS', 'maldives': 'MV', 'uae': 'AE', 'united arab emirates': 'AE',
    'turkey': 'TR', 'morocco': 'MA', 'jordan': 'JO', 'new zealand': 'NZ', 'canada': 'CA',
};

function resolveIsoCodeEtg(raw?: string): string | null {
    if (!raw) return null;
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    return COUNTRY_NAME_TO_ISO[raw.toLowerCase()] ?? null;
}

async function getEtgRegionId(cityName: string, countryCode?: string, rung?: DestinationRung): Promise<number | null> {
    try {
        const token = getEtgToken();
        const query = cityName.split(',')[0].trim();
        const abort = new AbortController();
        const t = setTimeout(() => abort.abort(), 5_000);
        const res = await fetch('https://api.worldota.net/api/b2b/v3/search/multicomplete/', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, language: 'en' }),
            signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        const regions: any[] = data?.data?.regions ?? [];
        const iso = resolveIsoCodeEtg(countryCode);
        const q = query.toLowerCase();
        const nameMatches = (r: any) => typeof r?.name === 'string' && r.name.toLowerCase().startsWith(q);
        const inCountry = (r: any) => !iso || r.country_code === iso;
        const pick = findBestMatch(regions, TYPE_PRIORITY[rung ?? 'city'], nameMatches, inCountry);
        if (!pick) {
            const seen = regions.filter(nameMatches).map((r: any) => r.type);
            console.warn(`[tgx-search] ETG multicomplete: no city/area match for "${query}" — types seen: ${seen.join(', ') || '(none)'}`);
        }
        return pick?.id ?? null;
    } catch {
        return null;
    }
}

async function fetchEtgHotelInfo(id: string): Promise<any | null> {
    try {
        const token = getEtgToken();
        const abort = new AbortController();
        const t = setTimeout(() => abort.abort(), 4_000);
        const res = await fetch('https://api.worldota.net/api/b2b/v3/hotel/info/', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, language: 'en' }),
            signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    }
}

async function seedEtgHotelContent(hotels: any[], cityName: string, countryCode?: string): Promise<void> {
    const sql = getSqlAdmin();
    const PARALLEL = 10;
    const MAX = Math.min(150, hotels.length);
    let saved = 0;
    for (let i = 0; i < MAX; i += PARALLEL) {
        const batch = hotels.slice(i, i + PARALLEL);
        const infos = await Promise.allSettled(batch.map((h: any) => fetchEtgHotelInfo(h.id)));
        for (let j = 0; j < batch.length; j++) {
            const r = infos[j];
            if (r.status !== 'fulfilled' || !r.value) continue;
            const info = r.value;
            const images: string[] = (info.images ?? [])
                .map((url: string) => (typeof url === 'string' ? url.replace('{size}', '640x400') : ''))
                .filter(Boolean)
                .slice(0, 10);
            const realCity: string = info.region?.name ?? cityName;
            const realCountry: string | null = info.region?.country_code ?? countryCode ?? null;
            try {
                await sql`
                    INSERT INTO hotel_content
                        (hotel_id, name, images, lat, lng, address, city, country,
                         description, star_rating, amenities, content_source, fetched_at)
                    VALUES (
                        ${info.id}, ${info.name ?? null}, ${sql.array(images)},
                        ${info.latitude ?? 0}, ${info.longitude ?? 0},
                        ${info.address ?? null}, ${realCity}, ${realCountry},
                        ${null}, ${info.star_rating ?? 0}, ${'[]'}::jsonb,
                        'etg', now()
                    )
                    ON CONFLICT (hotel_id) DO UPDATE SET
                        name        = CASE WHEN hotel_content.name IS NULL OR hotel_content.name = hotel_content.hotel_id
                                          THEN EXCLUDED.name ELSE hotel_content.name END,
                        images      = CASE WHEN array_length(hotel_content.images, 1) > 0
                                     THEN hotel_content.images ELSE EXCLUDED.images END,
                        lat         = CASE WHEN hotel_content.lat  != 0 THEN hotel_content.lat  ELSE EXCLUDED.lat  END,
                        lng         = CASE WHEN hotel_content.lng  != 0 THEN hotel_content.lng  ELSE EXCLUDED.lng  END,
                        address     = COALESCE(hotel_content.address, EXCLUDED.address),
                        city        = COALESCE(hotel_content.city, EXCLUDED.city),
                        star_rating = CASE WHEN hotel_content.star_rating != 0
                                     THEN hotel_content.star_rating ELSE EXCLUDED.star_rating END,
                        content_source = COALESCE(hotel_content.content_source, 'etg'),
                        fetched_at  = now()
                `;
                saved++;
            } catch { /* skip */ }
        }
        if (i + PARALLEL < MAX) await new Promise(r => setTimeout(r, 3_000));
    }
    console.log(`[tgx-search] ETG seeded ${saved}/${MAX} hotels for "${cityName}" into hotel_content`);
}

async function buildEtgResults(
    hotels: any[],
    label: string,
    params: TgxSearchParams,
): Promise<{ data: any[]; allMappable: any[]; totalCount: number }> {
    const empty = { data: [], allMappable: [], totalCount: 0 };
    if (!hotels.length) return empty;

    hotels.sort((a: any, b: any) => {
        const pa = parseFloat(a.rates?.[0]?.payment_options?.payment_types?.[0]?.show_amount ?? '999999');
        const pb = parseFloat(b.rates?.[0]?.payment_options?.payment_types?.[0]?.show_amount ?? '999999');
        return pa - pb;
    });

    const allIds = hotels.map((h: any) => h.id as string);
    const existingContent = await fetchHotelContent(allIds);
    const needInfo = hotels.filter((h: any) => !existingContent.get(h.id)?.name);
    const toFetch = needInfo.slice(0, 15);
    const infoResults = toFetch.length > 0
        ? await Promise.allSettled(toFetch.map((h: any) => fetchEtgHotelInfo(h.id as string)))
        : [];

    const infoMap = new Map<string, any>();
    for (let i = 0; i < toFetch.length; i++) {
        const r = infoResults[i];
        if (r.status === 'fulfilled' && r.value) infoMap.set(toFetch[i].id as string, r.value);
    }

    seedEtgHotelContent(hotels, label, params.countryCode).catch(() => {});

    const results = hotels.map((h: any) => {
        const rate = h.rates?.[0];
        const pt   = rate?.payment_options?.payment_types?.[0];
        const price    = parseFloat(pt?.show_amount    ?? '0');
        const currency = (pt?.show_currency_code ?? 'USD') as string;
        const dbContent = existingContent.get(h.id as string);
        const etgInfo   = infoMap.get(h.id as string);
        const src       = (dbContent?.name ? dbContent : null) ?? etgInfo;
        const rawImages: string[] = src?.images ?? [];
        const images = rawImages
            .map((url: string) => (typeof url === 'string' ? url.replace('{size}', '640x400') : ''))
            .filter(Boolean)
            .slice(0, 10);
        const lat = Number(src?.latitude ?? src?.lat ?? 0);
        const lng = Number(src?.longitude ?? src?.lng ?? 0);
        return {
            hotelId:      h.id,
            id:           h.id,
            name:         dbContent?.name ?? etgInfo?.name ?? h.id,
            price,
            currency,
            offerId:      `ETG:${h.id}:${rate?.match_hash ?? ''}`,
            refundableTag: 'UNKNOWN',
            starRating:   Number(src?.star_rating ?? 0),
            images,
            image:        images[0] ?? '',
            lat,
            lng,
            coordinates:  { lat, lng },
            address:      src?.address ?? '',
            location:     src?.address ?? '',
            city:         label,
            country:      params.countryCode ?? '',
            description:  '',
            amenities:    [],
            reviewRating: Number(dbContent?.review_rating ?? 0),
            rating:       Number(dbContent?.review_rating ?? 0),
            reviews:      Number(dbContent?.review_count ?? 0),
            reviewCount:  Number(dbContent?.review_count ?? 0),
            boardCode:    rate?.meal ?? 'RO',
            roomTypes:    [],
            provider:     'etg',
        };
    });

    const allMappable = results.filter(h => h.lat && h.lng);
    return { data: results, allMappable, totalCount: results.length };
}

async function searchEtgCity(
    cityName: string,
    params: TgxSearchParams,
    rung?: DestinationRung,
): Promise<{ data: any[]; allMappable: any[]; totalCount: number }> {
    const empty = { data: [], allMappable: [], totalCount: 0 };
    try {
        if (!process.env.ETG_KEY_ID || !process.env.ETG_API_KEY) return empty;
        const token = getEtgToken();
        const regionId = await getEtgRegionId(cityName, params.countryCode, rung);
        if (!regionId) {
            console.warn(`[tgx-search] ETG: no region_id for "${cityName}" (rung: ${rung ?? 'city'})`);
            return empty;
        }
        console.log(`[tgx-search] ETG ${rung ?? 'city'} search: region ${regionId} for "${cityName}" (${params.checkin}→${params.checkout})`);

        const serpAbort = new AbortController();
        const serpTimeout = setTimeout(() => serpAbort.abort(), 20_000);
        const serpRes = await fetch('https://api.worldota.net/api/b2b/v3/search/serp/region/', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region_id: regionId,
                checkin:   params.checkin,
                checkout:  params.checkout,
                guests:    [{ adults: Number(params.adults ?? 2) }],
                currency:  'USD',
                language:  'en',
                residency: 'us',
            }),
            signal: serpAbort.signal,
        });
        clearTimeout(serpTimeout);
        if (!serpRes.ok) { console.warn(`[tgx-search] ETG SERP ${serpRes.status}`); return empty; }
        const serpData = await serpRes.json();
        const hotels: any[] = serpData?.data?.hotels ?? [];
        console.log(`[tgx-search] ETG SERP: ${hotels.length} hotels for "${cityName}"`);
        return await buildEtgResults(hotels, cityName, params);
    } catch (e: any) {
        console.warn('[tgx-search] ETG region search failed:', e.message);
        return empty;
    }
}

// ─── Hotel search cache ───────────────────────────────────────────────────────

export const POPULAR_CITIES = new Set([
    'tokyo', 'bangkok', 'seoul', 'singapore', 'paris',
    'london', 'new york', 'dubai', 'barcelona', 'bali',
]);

export function isPopularCity(cityName: string): boolean {
    return POPULAR_CITIES.has(cityName.toLowerCase().trim());
}

export function getEffectiveTtl(cityName?: string): number {
    const standardTtl = parseInt(process.env.HOTEL_SEARCH_CACHE_TTL_MINUTES          ?? '120', 10);
    const popularTtl  = parseInt(process.env.HOTEL_SEARCH_CACHE_TTL_POPULAR_MINUTES   ?? '360', 10);
    return cityName && isPopularCity(cityName) ? popularTtl : standardTtl;
}

function buildHotelCacheKey(p: TgxSearchParams): string {
    const location = p.hotelCode
        ? `hotel:${p.hotelCode}`
        : (p.rung === 'country' || p.rung === 'province')
        ? `${p.rung}:${(p.cityName ?? '').toLowerCase().trim()}`
        : p.destinationCode
        ? `dest:${p.destinationCode}`
        : `city:${(p.cityName ?? '').toLowerCase().trim()}`;
    return [
        location,
        p.checkin,
        p.checkout,
        String(p.adults ?? 2),
        String(p.children ?? 0),
        p.guest_nationality ?? 'US',
    ].join('|');
}

async function getHotelSearchCache(key: string, ttlMinutes: number): Promise<{ result: any; stale: boolean } | null> {
    try {
        const sql = getSqlAdmin();
        const rows = await sql`
            SELECT result, (expires_at <= now()) AS stale
            FROM hotel_search_cache
            WHERE cache_key = ${key}
              AND expires_at > now() - (${ttlMinutes} * interval '1 minute')
            LIMIT 1
        `;
        if (!rows[0]) return null;
        return { result: rows[0].result, stale: Boolean(rows[0].stale) };
    } catch {
        return null;
    }
}

async function setHotelSearchCache(key: string, result: any, ttlMinutes: number): Promise<void> {
    try {
        const sql = getSqlAdmin();
        await sql`
            INSERT INTO hotel_search_cache (cache_key, result, expires_at)
            VALUES (${key}, ${sql.json(result)}, now() + ${`${ttlMinutes} minutes`}::interval)
            ON CONFLICT (cache_key) DO UPDATE
                SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at, created_at = now()
        `;
        console.log(`[hotel-cache] WRITE ${key} (ttl=${ttlMinutes}min)`);
    } catch (e: any) {
        console.error('[hotel-cache] Write failed (key:', key, '):', e.message);
    }
}

// ─── GraphQL queries ──────────────────────────────────────────────────────────

const CITY_SEARCH_QUERY = `
query TgxCitySearch($criteria: HotelCriteriaSearchInput!, $settings: HotelSettingsInput!, $filterSearch: HotelXFilterSearchInput) {
  hotelX {
    search(criteria: $criteria, settings: $settings, filterSearch: $filterSearch) {
      options {
        id hotelCode boardCode paymentType status
        price { currency net gross }
        token
        rooms { description }
        cancelPolicy { refundable }
      }
      errors { code type description }
      warnings { code type description }
    }
  }
}`;

const HOTEL_SEARCH_QUERY = `
query TgxHotelSearch($criteria: HotelCriteriaSearchInput!, $settings: HotelSettingsInput!, $filterSearch: HotelXFilterSearchInput) {
  hotelX {
    search(criteria: $criteria, settings: $settings, filterSearch: $filterSearch) {
      options {
        id hotelCode boardCode paymentType status
        price { currency net gross }
        token
        rooms { occupancyRefId code description }
        cancelPolicy {
          refundable
          cancelPenalties { deadline hoursBefore penaltyType currency value }
        }
      }
      errors { code type description }
    }
  }
}`;

// ─── DB enrichment ────────────────────────────────────────────────────────────

async function fetchHotelContent(hotelCodes: string[]) {
    if (!hotelCodes.length) return new Map<string, any>();
    const sql = getSqlAdmin();
    const rows = await sql`
        SELECT
            hotel_id,
            COALESCE(NULLIF(TRIM(name), ''), hotel_id) AS name,
            images,
            star_rating,
            lat,
            lng,
            address,
            city,
            country,
            description,
            amenities,
            review_rating,
            review_count,
            check_in_time,
            check_out_time,
            ratehawk_hid
        FROM hotel_content
        WHERE hotel_id = ANY(${hotelCodes})
    `;
    const map = new Map<string, any>();
    for (const row of rows) map.set(row.hotel_id, row);
    return map;
}

async function fetchHotelReviews(hotelCodes: string[]) {
    if (!hotelCodes.length) return new Map<string, any>();
    const sql = getSqlAdmin();
    const rows = await sql`
        SELECT hotel_id, rating, reviews_count
        FROM hotel_reviews
        WHERE hotel_id = ANY(${hotelCodes})
    `;
    const map = new Map<string, any>();
    for (const row of rows) map.set(row.hotel_id, row);
    return map;
}

// ─── Search params ────────────────────────────────────────────────────────────

export interface TgxSearchParams {
    checkin: string;
    checkout: string;
    adults?: number;
    children?: number;
    childrenAges?: number[];
    currency?: string;
    guest_nationality?: string;
    destinationCode?: string;
    cityName?: string;
    countryCode?: string;
    hotelCode?: string;
    rooms?: number;
    rung?: DestinationRung;
    lat?: number;
    lng?: number;
    bbox?: [number, number, number, number];
    bypassCache?: boolean;
}

// ─── Core search function ─────────────────────────────────────────────────────

function parseOtvEdges(edges: any[], cityName: string, countryCode?: string): Map<string, any> {
    const map = new Map<string, any>();
    for (const e of edges) {
        const d = e?.node?.hotelData;
        if (!d?.code) continue;
        const parsed = parseTgxHotelData(d, cityName, countryCode);
        if (!parsed._otvCity) parsed.city = cityName;
        map.set(parsed.hotel_id, parsed);
    }
    return map;
}

async function fetchOtvHotelCodesByCity(
    cityName: string,
    destinationCode?: string,
    countryCode?: string,
): Promise<{ codes: string[]; contentMap: Map<string, any> }> {
    try {
        const cfg = getTgxConfig();
        const PAGE_SIZE = 500;
        const MAX_PAGES = (destinationCode || countryCode) ? 2 : 3;
        const PORTFOLIO_QUERY = `query OtvHotelPortfolio($criteria: HotelXHotelListInput!, $token: String) {
               hotelX {
                 hotels(criteria: $criteria, token: $token) {
                   token
                   edges { node { hotelData { ${HOTEL_DATA_FIELDS} } } }
                 }
               }
             }`;

        const allEdges: any[] = [];
        let pageToken: string | null = null;

        for (let page = 0; page < MAX_PAGES; page++) {
            const criteria: Record<string, unknown> = { access: cfg.accessCode, maxSize: PAGE_SIZE };
            if (destinationCode) criteria.destinationCodes = [destinationCode];
            else if (countryCode) criteria.countries = [countryCode.toUpperCase()];

            const result: any = await tgxGraphQL(PORTFOLIO_QUERY, {
                criteria,
                ...(pageToken ? { token: pageToken } : {}),
            });
            const hotelList: any = result?.data?.hotelX?.hotels ?? {};
            const edges: any[] = hotelList.edges ?? [];
            allEdges.push(...edges);
            pageToken = hotelList.token ?? null;
            if (!pageToken || edges.length < PAGE_SIZE) break;
        }

        const contentMap = parseOtvEdges(allEdges, cityName, countryCode);
        const codes = [...contentMap.keys()];
        console.log(`[tgx-search] OTV portfolio returned ${codes.length} hotel codes for "${cityName}"`);

        if (codes.length > 0) {
            const bbox = countryCode ? COUNTRY_BBOX[countryCode.toUpperCase()] : null;
            const backfillMap = bbox
                ? new Map([...contentMap].filter(([, c]) => {
                    const lat = Number(c.lat ?? 0);
                    const lng = Number(c.lng ?? 0);
                    if (!lat && !lng) return true;
                    return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
                }))
                : contentMap;
            backfillHotelContent(backfillMap).catch((err: any) =>
                console.warn('[tgx-search] hotel_content backfill failed:', err.message)
            );
            const nullNameCodes = codes.filter(c => !contentMap.get(c)?.name);
            if (nullNameCodes.length > 0) {
                fetchEtgHotelContent(nullNameCodes)
                    .then(etgContent => {
                        if (etgContent.size > 0) {
                            for (const [id, c] of etgContent) {
                                const row = contentMap.get(id);
                                if (row) {
                                    if (c.name) row.name = c.name;
                                    if (c.description && !row.description) row.description = c.description;
                                    if (c.amenities?.length && !row.amenities?.length) row.amenities = c.amenities;
                                }
                            }
                            updateEtgContentInDb(etgContent).catch(() => {});
                        }
                    })
                    .catch(() => {});
            }
        }

        return { codes, contentMap };
    } catch (e: any) {
        console.warn('[tgx-search] OTV portfolio query failed:', e.message);
        return { codes: [], contentMap: new Map() };
    }
}

async function backfillHotelContent(contentMap: Map<string, any>): Promise<void> {
    const sql = getSqlAdmin();
    let saved = 0;
    for (const r of contentMap.values()) {
        if (!/^\d+$/.test(r.hotel_id) && !/^[A-Z]{2}\d+$/.test(r.hotel_id)) continue;
        const hasOtvCity = r._otvCity !== null && r._otvCity !== undefined;
        try {
            await sql`
                INSERT INTO hotel_content
                    (hotel_id, name, images, lat, lng, address, city, country,
                     description, star_rating, amenities, amenity_groups,
                     check_in_time, check_out_time, important_information,
                     contact_info, chain_code, giata_id,
                     content_source, fetched_at)
                VALUES (
                    ${r.hotel_id}, ${r.name}, ${sql.array(r.images)},
                    ${r.lat}, ${r.lng}, ${r.address}, ${r.city}, ${r.country},
                    ${r.description}, ${r.star_rating},
                    ${JSON.stringify(r.amenities ?? [])}::jsonb,
                    ${r.amenity_groups ? JSON.stringify(r.amenity_groups) : null}::jsonb,
                    ${r.check_in_time ?? null}, ${r.check_out_time ?? null},
                    ${r.important_information ?? null},
                    ${r.contact_info ? JSON.stringify(r.contact_info) : null}::jsonb,
                    ${r.chain_code ?? null}, ${r.giata_id ?? null},
                    'tgx', now()
                )
                ON CONFLICT (hotel_id) DO UPDATE SET
                    name        = CASE WHEN hotel_content.name IS NULL
                                       OR hotel_content.name = hotel_content.hotel_id
                                  THEN EXCLUDED.name ELSE hotel_content.name END,
                    images      = CASE WHEN array_length(EXCLUDED.images, 1) > 0
                                  THEN EXCLUDED.images ELSE hotel_content.images END,
                    lat         = CASE WHEN EXCLUDED.lat  != 0 THEN EXCLUDED.lat  ELSE hotel_content.lat  END,
                    lng         = CASE WHEN EXCLUDED.lng  != 0 THEN EXCLUDED.lng  ELSE hotel_content.lng  END,
                    address     = COALESCE(hotel_content.address,     EXCLUDED.address),
                    city        = CASE WHEN ${hasOtvCity}
                                  THEN EXCLUDED.city
                                  ELSE COALESCE(hotel_content.city, EXCLUDED.city) END,
                    country     = COALESCE(hotel_content.country,     EXCLUDED.country),
                    description = COALESCE(hotel_content.description, EXCLUDED.description),
                    star_rating = CASE WHEN hotel_content.star_rating != 0
                                  THEN hotel_content.star_rating ELSE EXCLUDED.star_rating END,
                    amenities   = CASE WHEN (hotel_content.amenities IS NOT NULL AND jsonb_typeof(hotel_content.amenities) = 'array' AND jsonb_array_length(hotel_content.amenities) > 0)
                                  THEN hotel_content.amenities ELSE EXCLUDED.amenities END,
                    amenity_groups        = COALESCE(hotel_content.amenity_groups,        EXCLUDED.amenity_groups),
                    check_in_time         = COALESCE(hotel_content.check_in_time,         EXCLUDED.check_in_time),
                    check_out_time        = COALESCE(hotel_content.check_out_time,        EXCLUDED.check_out_time),
                    important_information = COALESCE(hotel_content.important_information, EXCLUDED.important_information),
                    contact_info          = COALESCE(hotel_content.contact_info,          EXCLUDED.contact_info),
                    chain_code            = COALESCE(hotel_content.chain_code,            EXCLUDED.chain_code),
                    giata_id              = COALESCE(hotel_content.giata_id,              EXCLUDED.giata_id),
                    content_source = COALESCE(hotel_content.content_source, 'tgx'),
                    fetched_at  = now()
            `;
            saved++;
        } catch {
            // Skip individual failures
        }
    }
    console.log(`[tgx-search] hotel_content backfilled ${saved} hotels`);
}

function normalizeHotelName(name: string): string {
    return name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\b(hotel|the|a|an|london|paris|tokyo|city|of|in|at|by|for|uk|england)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasEmptyHotelsError(errors: any[]): boolean {
    return errors.some(
        (e) => e.code === 'WRONG_FIELD' && e.description?.toLowerCase().includes('empty hotels')
    );
}

const _failedDestCodes = new Set<string>();
let _failedDestCodesPromise: Promise<void> | null = null;

function loadFailedDestCodes(): Promise<void> {
    if (_failedDestCodesPromise) return _failedDestCodesPromise;
    _failedDestCodesPromise = (async () => {
        try {
            const sql = getSqlAdmin();
            const rows = await sql`SELECT dest_code FROM tgx_failed_dest_codes WHERE created_at > now() - INTERVAL '7 days'`;
            for (const r of rows) _failedDestCodes.add(r.dest_code as string);
            if (rows.length) console.log(`[tgx-search] Loaded ${rows.length} known-bad dest codes from DB (last 7d)`);
        } catch (e: any) {
            console.warn('[tgx-search] Could not load tgx_failed_dest_codes:', e.message);
        }
    })();
    return _failedDestCodesPromise;
}

export function clearFailedDestCodesCache(): void {
    _failedDestCodes.clear();
    _failedDestCodesPromise = null;
}

function persistFailedDestCode(destCode: string, cityName = ''): void {
    _failedDestCodes.add(destCode);
    getSqlAdmin()`
        INSERT INTO tgx_failed_dest_codes (dest_code, city_key)
        VALUES (${destCode}, ${cityName})
        ON CONFLICT (dest_code) DO UPDATE SET created_at = now(), city_key = EXCLUDED.city_key
    `.catch((e: any) => console.warn('[tgx-search] Could not persist failed dest code:', e.message));
}

const _inflight = new Map<string, Promise<any>>();
const _backgroundRefreshing = new Set<string>();

async function runCityFallback(
    cityName: string,
    countryCode: string | undefined,
    baseCriteria: Record<string, unknown>,
    prefetchDestCode: Promise<string | undefined>,
    centerLat?: number,
    centerLng?: number,
) {
    await loadFailedDestCodes();

    console.warn(`[tgx-search] OTV destination search empty for "${cityName}" — resolving TGX destination code`);
    const resolvedCode = await prefetchDestCode;
    if (resolvedCode) {
        console.log(`[tgx-search] Got TGX destination code "${resolvedCode}" for "${cityName}" — searching`);
        if (_failedDestCodes.has(resolvedCode)) {
            console.log(`[tgx-search] Dest code "${resolvedCode}" is a known OTV miss — skipping dest-code search for "${cityName}"`);
        } else {
            const __t0 = Date.now();
            let destResult: any;
            const _cfg = getTgxConfig();
            const settingsDestCode = getTgxSettings(_cfg, 15_000, true, 'USD');
            const filterSearchDest = getTgxFilterSearch(_cfg);
            try {
                destResult = await tgxGraphQL(CITY_SEARCH_QUERY, {
                    criteria: { ...baseCriteria, destinations: [resolvedCode] },
                    settings: settingsDestCode,
                    filterSearch: filterSearchDest,
                }, 25_000);
            } catch (destErr: any) {
                console.warn(`[tgx-search] Dest code "${resolvedCode}" search failed (${destErr.message?.slice(0, 80)}) — falling back to hotel-code search`);
                destResult = null;
            }
            if (!destResult) {
                console.log(`[tgx-search][TIMING] dest-code attempt for "${resolvedCode}" failed after ${Date.now() - __t0}ms`);
            } else {
                console.log(`[tgx-search][TIMING] dest-code round-trip for "${resolvedCode}" took ${Date.now() - __t0}ms`);
                const destOptions: TgxOption[] = destResult?.data?.hotelX?.search?.options || [];
                const destErrors: any[] = destResult?.data?.hotelX?.search?.errors || [];
                const destWarnings: any[] = destResult?.data?.hotelX?.search?.warnings || [];
                if (destWarnings.length) console.warn(`[tgx-search] dest-code warnings for "${resolvedCode}":`, JSON.stringify(destWarnings).slice(0, 500));
                const destMerchant = destOptions.filter(
                    (o) => o.paymentType === 'MERCHANT' && (o.status === 'AVAILABLE' || o.status === 'OK')
                );
                if (destMerchant.length > 0) {
                    console.log(`[tgx-search] Destination-code search returned ${destMerchant.length} options for "${cityName}"`);
                    if (cityName) {
                        fetchOtvHotelCodesByCity(cityName, resolvedCode, countryCode)
                            .then(otv => {
                                if (otv.codes.length > 0) {
                                    const nullNames = otv.codes.filter(c => !otv.contentMap.get(c)?.name);
                                    if (nullNames.length > 0) {
                                        fetchEtgHotelContent(nullNames)
                                            .then(etgContent => updateEtgContentInDb(etgContent))
                                            .catch(() => {});
                                    }
                                }
                            })
                            .catch(() => {});
                    }
                    return buildCityResults(destMerchant, cityName, countryCode);
                }
                const isTransient = hasEmptyHotelsError(destErrors) ||
                    destErrors.some((e: any) => e.code === 'ALL_PROCESSES_FAILED');
                if (isTransient) {
                    console.warn(`[tgx-search] Dest code "${resolvedCode}" transient failure (${destErrors[0]?.code ?? 'empty'}) — not recorded as OTV miss`);
                } else {
                    persistFailedDestCode(resolvedCode, cityName);
                    if (destErrors.length) {
                        console.warn('[tgx-search] Destination-code search errors:', destErrors.map((e: any) => e.description || e.code).join(', '));
                        console.warn(`[tgx-search] Dest code "${resolvedCode}" had errors and 0 merchant options — recorded as OTV miss`);
                    } else {
                        console.warn(`[tgx-search] Dest code "${resolvedCode}" returned 0 options with no errors — recorded as OTV miss`);
                    }
                }
            }
        }
    } else {
        let isNoneSentinel = false;
        try {
            const _sql = getSqlAdmin();
            const cityKey = cityName?.toLowerCase().trim() ?? '';
            const scopedKey = countryCode ? `${cityKey}:${countryCode.toLowerCase()}` : null;
            const keys = scopedKey ? [cityKey, scopedKey] : [cityKey];
            const noneRows = await _sql`SELECT 1 FROM tgx_destination_cache WHERE city_key = ANY(${keys}) AND destination_code = 'NONE' LIMIT 1`;
            if (noneRows.length > 0) isNoneSentinel = true;
        } catch { /* non-fatal */ }

        if (isNoneSentinel) {
            console.log(`[tgx-search] NONE sentinel for "${cityName}" — skipping extended resolve, going to hotel-code fallback`);
        } else {
            console.warn(`[tgx-search] Dest code resolution timed out for "${cityName}" — awaiting 12s more`);
            const bgCode = await Promise.race([
                backgroundResolveDestCode(cityName, undefined),
                new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 12_000)),
            ]);
            if (bgCode && !_failedDestCodes.has(bgCode)) {
                const _cfg = getTgxConfig();
                try {
                    const extResult = await tgxGraphQL(CITY_SEARCH_QUERY, {
                        criteria: { ...baseCriteria, destinations: [bgCode] },
                        settings: getTgxSettings(_cfg, 12_000, true, 'USD'),
                        filterSearch: getTgxFilterSearch(_cfg),
                    }, 20_000);
                    const extMerchant = ((extResult?.data?.hotelX?.search?.options) ?? []).filter(
                        (o: any) => o.paymentType === 'MERCHANT' && (o.status === 'AVAILABLE' || o.status === 'OK')
                    );
                    if (extMerchant.length > 0) {
                        console.log(`[tgx-search] Extended dest-code search returned ${extMerchant.length} options for "${cityName}"`);
                        if (cityName) fetchOtvHotelCodesByCity(cityName, bgCode, countryCode).catch(() => {});
                        return buildCityResults(extMerchant, cityName, countryCode);
                    }
                } catch (e: any) {
                    console.warn(`[tgx-search] Extended dest-code search failed: ${e.message?.slice(0, 80)}`);
                }
            }
        }
    }

    if (cityName) {
        try {
            const sqlAdmin = getSqlAdmin();
            let catalogRows: { hotel_id: string; lat?: number; lng?: number }[];

            if (centerLat && centerLng) {
                const RADIUS_KM = 50;
                const DEG = RADIUS_KM / 111;
                const minLat = centerLat - DEG, maxLat = centerLat + DEG;
                const minLng = centerLng - DEG, maxLng = centerLng + DEG;
                const bboxRows = await sqlAdmin<{ hotel_id: string; lat: number; lng: number }[]>`
                    SELECT hotel_id, lat, lng FROM hotel_content
                    WHERE lat BETWEEN ${minLat} AND ${maxLat}
                      AND lng BETWEEN ${minLng} AND ${maxLng}
                      AND lat != 0 AND lng != 0
                      AND hotel_id ~ '^[0-9]+$'
                    LIMIT 1000`;
                catalogRows = bboxRows.filter(r => {
                    const dLat = ((Number(r.lat) - centerLat) * Math.PI) / 180;
                    const dLng = ((Number(r.lng) - centerLng) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos((centerLat * Math.PI) / 180) * Math.cos((Number(r.lat) * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
                    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= RADIUS_KM;
                });
            } else {
                const cityOnly = cityName.split(',')[0].trim();
                catalogRows = countryCode
                    ? await sqlAdmin<{ hotel_id: string }[]>`
                        SELECT hotel_id FROM hotel_content
                        WHERE LOWER(TRIM(city)) = LOWER(${cityOnly})
                          AND LOWER(country) = LOWER(${countryCode})
                          AND hotel_id ~ '^[0-9]+$'
                          AND lat != 0 AND lng != 0
                        LIMIT 300`
                    : await sqlAdmin<{ hotel_id: string }[]>`
                        SELECT hotel_id FROM hotel_content
                        WHERE LOWER(TRIM(city)) = LOWER(${cityOnly})
                          AND hotel_id ~ '^[0-9]+$'
                          AND lat != 0 AND lng != 0
                        LIMIT 300`;
            }

            const catalogIds = catalogRows.map(r => r.hotel_id);
            if (catalogIds.length > 0) {
                console.log(`[tgx-search] Hotel-code fallback: querying TGX with ${catalogIds.length} IDs for "${cityName}"`);
                const _cfg = getTgxConfig();
                const hotelResult = await tgxGraphQL(CITY_SEARCH_QUERY, {
                    criteria: { ...baseCriteria, hotels: catalogIds },
                    settings: getTgxSettings(_cfg, 15_000, true, 'USD'),
                    filterSearch: getTgxFilterSearch(_cfg),
                }, 25_000).catch(() => null);
                const merchant = ((hotelResult?.data?.hotelX?.search?.options) ?? []).filter(
                    (o: any) => o.paymentType === 'MERCHANT' && (o.status === 'AVAILABLE' || o.status === 'OK')
                );
                if (merchant.length > 0) {
                    console.log(`[tgx-search] Hotel-code fallback: ${merchant.length} options for "${cityName}"`);
                    return buildCityResults(merchant, cityName, countryCode);
                }
            }
        } catch (e: any) {
            console.warn(`[tgx-search] Hotel-code fallback failed for "${cityName}": ${e.message?.slice(0, 80)}`);
        }
    }

    return buildCityResults([], cityName, countryCode);
}

export async function runTgxSearch(params: TgxSearchParams) {
    const key = buildHotelCacheKey(params);
    const ttl = getEffectiveTtl(params.cityName);

    if (ttl > 0 && !params.bypassCache) {
        const cached = await getHotelSearchCache(key, ttl);
        if (cached !== null) {
            if (!cached.stale) {
                console.log(`[hotel-cache] HIT ${key}`);
                return cached.result;
            }
            console.log(`[hotel-cache] STALE ${key} — serving stale result, refreshing in background`);
            if (!_inflight.has(key) && !_backgroundRefreshing.has(key)) {
                _backgroundRefreshing.add(key);
                _runTgxSearch(params)
                    .then(result => {
                        const hasCityResults = Array.isArray(result?.data) && result.data.length > 0;
                        const hasHotelRooms  = !Array.isArray(result?.data)
                            && Array.isArray(result?.data?.roomTypes)
                            && result.data.roomTypes.length > 0;
                        if (hasCityResults || hasHotelRooms) {
                            setHotelSearchCache(key, result, ttl).catch(() => {});
                        }
                    })
                    .catch((e: any) => console.error('[hotel-cache] Background refresh failed:', e.message))
                    .finally(() => _backgroundRefreshing.delete(key));
            }
            return cached.result;
        }
    }

    if (!params.bypassCache) {
        const existing = _inflight.get(key);
        if (existing) {
            console.log(`[hotel-cache] INFLIGHT ${key} — waiting for in-progress search`);
            return existing;
        }
    }

    const promise = _runTgxSearch(params)
        .then(result => {
            if (ttl > 0) {
                const hasCityResults = Array.isArray(result?.data) && result.data.length > 0;
                const hasHotelRooms  = !Array.isArray(result?.data)
                    && Array.isArray(result?.data?.roomTypes)
                    && result.data.roomTypes.length > 0;
                if (hasCityResults || hasHotelRooms) {
                    setHotelSearchCache(key, result, ttl).catch(() => {});
                }
            }
            return result;
        })
        .finally(() => { _inflight.delete(key); });

    if (!params.bypassCache) {
        _inflight.set(key, promise);
    }
    return promise;
}

async function _runTgxSearch(params: TgxSearchParams): Promise<any> {
    const {
        checkin, checkout,
        adults = 2, children = 0, childrenAges,
        destinationCode, cityName, countryCode,
        hotelCode,
        guest_nationality = 'US',
        rung,
    } = params;

    if (rung === 'district' || rung === 'poi') {
        return { data: [], allMappable: [], totalCount: 0 };
    }

    const currency = 'USD';
    const occupancies = buildOccupancies(Number(adults), Number(children), childrenAges);

    let destinations: string[] | undefined;
    let hotels: string[] | undefined;

    if (hotelCode) {
        hotels = [String(hotelCode)];
    } else if (destinationCode) {
        destinations = [String(destinationCode)];
    } else if (cityName) {
        const baseCriteria = { checkIn: checkin, checkOut: checkout, occupancies, nationality: guest_nationality, currency };

        let resolvedCountry: string | undefined = countryCode || undefined;
        if (!resolvedCountry) {
            try {
                const sql = getSqlAdmin();
                const cityOnly = cityName.split(',')[0].trim();
                const rows = await sql<{ country: string; n: bigint }[]>`
                    SELECT country, COUNT(*) AS n
                    FROM hotel_content
                    WHERE city ILIKE ${'%' + cityOnly + '%'}
                      AND country IS NOT NULL AND country != ''
                      AND LENGTH(country) = 2
                    GROUP BY country ORDER BY n DESC LIMIT 1
                `;
                if (rows.length > 0) resolvedCountry = rows[0].country.toUpperCase();
                if (resolvedCountry) console.log(`[tgx-search] inferred countryCode "${resolvedCountry}" for "${cityName}" from hotel_content`);
            } catch {}
        }

        return runCityFallback(
            cityName, resolvedCountry, baseCriteria,
            resolveTgxDestinationCode(cityName, undefined).catch(() => undefined),
            params.lat, params.lng,
        );
    } else {
        throw new Error('destinationCode, hotelCode, or cityName is required');
    }

    const criteria = {
        checkIn: checkin,
        checkOut: checkout,
        occupancies,
        nationality: guest_nationality,
        currency,
        ...(hotels ? { hotels } : { destinations }),
    };

    const gqlQuery = hotelCode ? HOTEL_SEARCH_QUERY : CITY_SEARCH_QUERY;
    const cfg = getTgxConfig();
    const searchSettings = destinations
        ? getTgxSettings(cfg, 15_000, true, 'USD')
        : getTgxSettings(cfg, 12_000, false, 'USD');
    const filterSearch = getTgxFilterSearch(cfg);

    const result = await tgxGraphQL(gqlQuery, { criteria, settings: searchSettings, filterSearch }, destinations ? 25_000 : 13_000);

    const options: TgxOption[] = result?.data?.hotelX?.search?.options || [];
    const gqlErrors = result?.data?.hotelX?.search?.errors || [];

    if (gqlErrors.length) {
        console.warn('[tgx-search] GraphQL errors:', gqlErrors.map((e: any) => e.description || e.code).join(', '));
    }

    const merchantOptions = options.filter(
        (o) => o.paymentType === 'MERCHANT' && (o.status === 'AVAILABLE' || o.status === 'OK')
    );

    if (hotelCode) {
        const sorted = merchantOptions
            .sort((a, b) => (a.price.gross || a.price.net) - (b.price.gross || b.price.net));

        const uniqueRoomCodes = [
            ...new Set(sorted.map(o => o.rooms?.[0]?.code).filter((c): c is string => Boolean(c))),
        ];
        const roomDescMap = new Map<string, string>(
            sorted
                .map(o => [o.rooms?.[0]?.code, o.rooms?.[0]?.description] as [string, string])
                .filter(([c, d]) => Boolean(c && d)),
        );

        const [contentMap, reviewMap, roomCatalog] = await Promise.all([
            fetchHotelContent([String(hotelCode)]),
            fetchHotelReviews([String(hotelCode)]),
            fetchTgxRoomCatalog(String(hotelCode), uniqueRoomCodes, roomDescMap),
        ]);

        const roomTypes = sorted.map(opt => {
            const normalized = normalizeOption(opt);
            const photos = roomCatalog.get(normalized.roomCode ?? '');
            return photos?.length ? { ...normalized, roomPhotos: photos } : normalized;
        });

        const content = contentMap.get(String(hotelCode));
        const reviews = reviewMap.get(String(hotelCode));
        const imageList: string[] = content?.images ?? [];
        const reviewRating = Number(reviews?.rating ?? content?.review_rating ?? 0);

        if (!content?.ratehawk_hid && content?.name && process.env.ETG_KEY_ID) {
            backgroundSeedEtgContent(String(hotelCode), content.name).catch(() => {});
        }

        return {
            data: {
                roomTypes,
                hotelId:     String(hotelCode),
                name:        content?.name || String(hotelCode),
                images:      imageList,
                image:       imageList[0] ?? '',
                lat:         Number(content?.lat ?? 0),
                lng:         Number(content?.lng ?? 0),
                coordinates: { lat: Number(content?.lat ?? 0), lng: Number(content?.lng ?? 0) },
                address:     content?.address ?? '',
                city:        content?.city ?? '',
                country:     content?.country ?? '',
                description: content?.description ?? '',
                amenities:   content?.amenities ?? [],
                starRating:  content?.star_rating ?? 0,
                reviewRating,
                reviewCount: reviews?.reviews_count ?? content?.review_count ?? 0,
            },
        };
    }

    return buildCityResults(merchantOptions, cityName, countryCode);
}

async function buildCityResults(
    merchantOptions: TgxOption[],
    cityName?: string,
    countryCode?: string,
    preloadedContent: Map<string, any> = new Map(),
) {
    const byHotel = new Map<string, TgxOption>();
    for (const opt of merchantOptions) {
        const existing = byHotel.get(opt.hotelCode);
        const price = opt.price.gross || opt.price.net;
        if (!existing || price < (existing.price.gross || existing.price.net)) {
            byHotel.set(opt.hotelCode, opt);
        }
    }

    const hotelCodes = Array.from(byHotel.entries())
        .filter(([code]) => /^\d+$/.test(code) || /^[A-Z]{2}\d+$/.test(code))
        .sort(([, a], [, b]) => (a.price.gross || a.price.net) - (b.price.gross || b.price.net))
        .slice(0, 300)
        .map(([code]) => code);
    const [contentMap, reviewMap] = await Promise.all([
        fetchHotelContent(hotelCodes),
        fetchHotelReviews(hotelCodes),
    ]);

    const bbox = countryCode ? COUNTRY_BBOX[countryCode.toUpperCase()] : null;
    const filteredCodes = !bbox ? hotelCodes : hotelCodes.filter(code => {
        const c = contentMap.get(code) ?? preloadedContent.get(code);
        if (!c) return true;
        const lat = Number(c.lat ?? c.latitude ?? 0);
        const lng = Number(c.lng ?? c.longitude ?? 0);
        if (!lat && !lng) return true;
        return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
    });
    if (filteredCodes.length < hotelCodes.length) {
        console.warn(`[tgx-search] buildCityResults: filtered ${hotelCodes.length - filteredCodes.length} confirmed out-of-country hotels for "${cityName}" (${countryCode})`);
    }

    if (filteredCodes.length > 0) {
        const noNameCodes = filteredCodes.filter(c => !contentMap.get(c)?.name && !preloadedContent.get(c)?.name);
        if (noNameCodes.length >= hotelCodes.length * 0.3) {
            try {
                const etgContent = await fetchEtgHotelContent(noNameCodes);
                if (etgContent.size > 0) {
                    for (const [code, c] of etgContent) {
                        const row = contentMap.get(code);
                        if (row) {
                            if (c.name) row.name = row.name || c.name;
                            if (c.description && !row.description) row.description = c.description;
                            if (c.amenities?.length && !row.amenities?.length) row.amenities = c.amenities;
                        } else {
                            preloadedContent.set(code, { ...(preloadedContent.get(code) ?? {}), ...c });
                        }
                    }
                    updateEtgContentInDb(etgContent).catch(() => {});
                }
            } catch (e: any) {
                console.warn('[tgx-search] ETG content enrichment skipped:', e.message);
            }
        }
    }

    const hotels_result = filteredCodes.map((code) => {
        const opt     = byHotel.get(code)!;
        const content = contentMap.get(code) ?? preloadedContent.get(code);
        const reviews = reviewMap.get(code);
        const tokenId = opt.token || opt.id;
        const reviewRating = Number(reviews?.rating ?? content?.review_rating ?? 0);
        const imageList: string[] = content?.images ?? [];
        return {
            hotelId:      code,
            id:           code,
            name:         content?.name || preloadedContent.get(code)?.name || code,
            price:        opt.price.gross || opt.price.net,
            currency:     opt.price.currency,
            offerId:      `TGX:${tokenId}`,
            refundableTag: opt.cancelPolicy?.refundable ? 'REFUNDABLE' : 'NON_REFUNDABLE',
            starRating:   content?.star_rating ?? 0,
            images:       imageList,
            image:        imageList[0] ?? '',
            lat:          Number(content?.lat ?? 0),
            lng:          Number(content?.lng ?? 0),
            coordinates:  { lat: Number(content?.lat ?? 0), lng: Number(content?.lng ?? 0) },
            address:      content?.address ?? '',
            location:     content?.address ?? '',
            city:         content?.city ?? cityName ?? '',
            country:      content?.country ?? countryCode ?? '',
            description:  content?.description ?? '',
            amenities:    content?.amenities ?? [],
            reviewRating,
            rating:       reviewRating,
            reviews:      reviews?.reviews_count ?? content?.review_count ?? 0,
            reviewCount:  reviews?.reviews_count ?? content?.review_count ?? 0,
            checkInTime:  content?.check_in_time ?? null,
            checkOutTime: content?.check_out_time ?? null,
            boardCode:    opt.boardCode,
            roomTypes:    [normalizeOption(opt)],
            _tgxToken:    opt.token,
        };
    });

    const seenNames = new Set<string>();
    const deduped = hotels_result.filter((h) => {
        if (!h.name || h.name === h.hotelId) return true;
        const key = normalizeHotelName(h.name);
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
    });

    const allMappable = deduped.filter((h) => h.lat && h.lng);
    return { data: deduped, allMappable, totalCount: deduped.length };
}
