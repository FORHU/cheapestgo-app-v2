/**
 * TravelgateX GraphQL client — server-side only.
 *
 * Handles authentication, request construction, and raw response parsing
 * for the HotelX API (OTV/RateHawk supplier).
 */

// ─── Config ───────────────────────────────────────────────────────────────────

export function getTgxConfig() {
    return {
        apiKey:       process.env.TRAVELGATE_API_KEY!,
        accessCode:   process.env.TRAVELGATE_CODE     || '38327',
        endpoint:     process.env.TRAVELGATE_ENDPOINT_URL || 'https://api.travelgate.com',
        client:       process.env.TRAVELGATE_CLIENT   || 'forhuinc',
        supplier:     process.env.TRAVELGATE_SUPPLIER || 'OTV',
        context:      process.env.TRAVELGATE_CONTEXT  || 'OTV',
    };
}

export function getTgxSettings(cfg = getTgxConfig(), timeout = 18000, withDestPlugins = false, targetCurrency?: string) {
    // timeout: mandatory per TGX docs; max 25,000 ms for Search.
    // auditTransactions: false improves response time.
    const base = {
        context:           cfg.context,
        client:            cfg.client,
        timeout,
        auditTransactions: false,
    };
    if (!withDestPlugins && !targetCurrency) return base;

    const plugins: object[] = [];

    if (withDestPlugins) {
        // Destination-search plugins (both required for TGX dest-code searches):
        //   search_by_destination: translates TGX destination codes → OTV hotel codes.
        //     Without this, TGX returns WRONG_FIELD/Empty hotels for any destination code.
        //   cheapest_price: reduces response from ~16MB to ~20KB (Phuket = ~84k options).
        //     Without this, large destination responses exceed the 25s HTTP abort timeout.
        plugins.push(
            {
                pluginsType: [{
                    name:       'search_by_destination',
                    parameters: [{ key: 'accessID', value: cfg.accessCode }],
                }],
            },
            {
                pluginsType: [{
                    name:       'cheapest_price',
                    parameters: [
                        { key: 'primaryKey',    value: 'hotel' },
                        { key: 'optionsPerKey', value: '1' },
                    ],
                }],
            },
        );
    }

    if (targetCurrency) {
        // Currency Converter plugin: converts OTV supplier prices (typically PHP) to the
        // target currency using rates from HotelX_0000/BusinessRules/currency_map.csv on SFTP.
        // exclude:false keeps options whose currency isn't in the CSV rather than hiding them,
        // so a missing/incomplete SFTP file degrades gracefully instead of zeroing results.
        plugins.push({
            pluginsType: [{
                name:       'currency_exchange',
                parameters: [
                    { key: 'currency', value: targetCurrency },
                    { key: 'exclude',  value: 'false' },
                ],
            }],
        });
    }

    return { ...base, plugins };
}

// filterSearch tells TGX which access code to route the request to.
// Complements search_by_destination (dest code translation) rather than replacing it.
export function getTgxFilterSearch(cfg = getTgxConfig()) {
    return {
        access: { includes: [cfg.accessCode] },
    };
}

// ─── GraphQL request ──────────────────────────────────────────────────────────

export async function tgxGraphQL<T = any>(
    query: string,
    variables?: Record<string, any>,
    httpTimeoutMs = 30_000,
): Promise<T> {
    const cfg = getTgxConfig();

    if (!cfg.apiKey) throw new Error('TRAVELGATE_API_KEY is not set');

    const payload = JSON.stringify(variables ? { query, variables } : { query });

    if (process.env.NODE_ENV === 'development') {
        console.log('[tgx] →', cfg.endpoint);
        console.log('[tgx] variables:', JSON.stringify(variables, null, 2));
    }

    const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Apikey ${cfg.apiKey}`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
        },
        body: payload,
        signal: AbortSignal.timeout(httpTimeoutMs),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[tgx] HTTP error body:', text.slice(0, 2000));
        throw new Error(`TravelgateX API error ${res.status}: ${text.slice(0, 2000)}`);
    }

    const body = await res.json();

    if (process.env.NODE_ENV === 'development') {
        const optionCount = body?.data?.hotelX?.search?.options?.length;
        const errors = body?.data?.hotelX?.search?.errors;
        console.log('[tgx] ← options:', optionCount ?? 'n/a', '| errors:', JSON.stringify(errors ?? []));
    }

    if (body.errors?.length) {
        const msg = body.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ');
        throw new Error(`TravelgateX GraphQL errors: ${msg}`);
    }

    return body as T;
}

// ─── Occupancy builder ────────────────────────────────────────────────────────

export function buildOccupancies(adults: number, children = 0, childrenAges: number[] = []) {
    const paxes: { age: number }[] = [];
    for (let i = 0; i < adults; i++) paxes.push({ age: 30 });
    if (childrenAges.length) {
        for (const age of childrenAges) paxes.push({ age });
    } else {
        for (let i = 0; i < children; i++) paxes.push({ age: 10 });
    }
    return [{ paxes }];
}

// ─── Board code → human label ─────────────────────────────────────────────────

const BOARD_CODE_LABELS: Record<string, string> = {
    // Standard codes
    RO: 'Room only',
    BB: 'Bed & Breakfast',
    HB: 'Half Board',
    FB: 'Full Board',
    AI: 'All Inclusive',
    SC: 'Self Catering',
    CB: 'Continental Breakfast',
    AB: 'American Breakfast',
    EB: 'English Breakfast',
    // OTV (RateHawk) lowercase codes
    nomeal:     'Room only',
    breakfast:  'Breakfast included',
    halfboard:  'Half Board',
    fullboard:  'Full Board',
    allinclusive: 'All Inclusive',
};

// ─── Option normalizer ────────────────────────────────────────────────────────

export interface TgxOption {
    id: string;
    hotelCode: string;
    boardCode: string;
    paymentType: string;
    status: string;
    price: { currency: string; net: number; gross: number };
    token: string;
    rooms?: Array<{ occupancyRefId: number; code: string; description: string; medias?: Array<{ url: string; type?: string }> }>;
    cancelPolicy?: {
        refundable: boolean;
        cancelPenalties?: Array<{
            deadline: string;
            hoursBefore: number;
            penaltyType: string;
            currency: string;
            value?: number;
        }>;
    };
    surcharges?: Array<{ chargeType: string; mandatory: boolean; price: { net: number; gross: number; currency: string } }>;
}

export function normalizeOption(opt: TgxOption) {
    // TGX docs: id is the canonical option identifier that must be passed to Quote.
    // token is the supplier-native token; keep it in _tgx for parsing (hotel code/dates).
    const quoteId = opt.id || opt.token;
    return {
        offerId: `TGX:${quoteId}`,
        roomName: opt.rooms?.[0]?.description || opt.boardCode || 'Room',
        roomCode: opt.rooms?.[0]?.code,
        boardCode: opt.boardCode,
        price: opt.price.gross || opt.price.net,
        net: opt.price.net,
        gross: opt.price.gross,
        currency: opt.price.currency,
        refundable: opt.cancelPolicy?.refundable ?? false,
        refundableTag: opt.cancelPolicy?.refundable ? 'REFUNDABLE' : 'NON_REFUNDABLE',
        cancelPolicy: opt.cancelPolicy,
        rates: [{
            retailRate: {
                total: [{ amount: opt.price.gross || opt.price.net, currency: opt.price.currency }],
                currency: opt.price.currency,
            },
            boardType: opt.boardCode,
            boardName: BOARD_CODE_LABELS[opt.boardCode] ?? opt.boardCode ?? 'Room only',
            refundableTag: opt.cancelPolicy?.refundable ? 'REFUNDABLE' : 'NON_REFUNDABLE',
            cancellationPolicies: opt.cancelPolicy?.cancelPenalties || [],
            _tgx: {
                token: opt.token,
                id: opt.id,
                boardCode: opt.boardCode,
                paymentType: opt.paymentType,
                cancelPolicy: opt.cancelPolicy,
            },
        }],
    };
}
