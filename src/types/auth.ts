export type { User, AuthStep } from '@/shared/types';

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export type SocialProvider = 'google' | 'apple' | 'facebook';
