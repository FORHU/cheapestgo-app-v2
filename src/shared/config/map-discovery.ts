import { Search, Utensils, Coffee, Landmark, ShoppingBasket, Pill, Bus } from 'lucide-react';

export const POI_FILTERS = [
    { id: 'all',        icon: Search        },
    { id: 'restaurant', icon: Utensils      },
    { id: 'cafe',       icon: Coffee        },
    { id: 'attraction', icon: Landmark      },
    { id: 'grocery',    icon: ShoppingBasket },
    { id: 'medical',    icon: Pill          },
    { id: 'transit',    icon: Bus           },
] as const;

export type PoiCategory = typeof POI_FILTERS[number]['id'];
