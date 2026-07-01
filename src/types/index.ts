export * from '@/shared/types';
export type { RegisterData, SocialProvider } from './auth';
export * from './landing';

export interface RecentItem {
    id: string;
    destination: string;
    dates: string;
    type: string;
    image: string;
    price: number;
}
