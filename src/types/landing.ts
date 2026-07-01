export interface TelemetryData {
    label: string;
    value: string;
    subValue: string;
    trend: 'up' | 'down' | 'stable';
    icon: 'chart' | 'plane' | 'sun';
}

export interface Deal {
    id: string;
    title: string;
    subtitle: string;
    discount: string;
    originalPrice: number;
    salePrice: number;
    currency?: string;
    image: string;
    endsIn: string;
    tag?: string;
    origin?: string;
    destination?: string;
    departure_date?: string;
    return_date?: string;
    cabinClass?: string;
    lastRefreshedAt?: string;
}

export interface WeekendDeal {
    id: string | number;
    name: string;
    location: string;
    rating: number;
    reviews: number;
    originalPrice: number;
    salePrice: number;
    currency: string;
    image: string;
    badge?: string;
    hotelCode?: string;
    checkIn?: string;
    checkOut?: string;
}

export interface RecentSearch {
    id: string | number;
    destination: string;
    dates: string;
    travelers: string;
    rooms: string;
}

export interface VacationPackage {
    id: string | number;
    name: string;
    location: string;
    rating: number;
    reviews: number;
    originalPrice: number;
    salePrice: number;
    image: string;
    includes: string[];
    destinationCode?: string;
}

export const packageTabs = ["All Places", "Ho Chi Minh City", "Bali", "Seoul", "Bangkok"];
export const styleTabs = ['Beach', 'Kid-Friendly', 'Ski', 'Romantic', 'Wellness and Relaxation'];
