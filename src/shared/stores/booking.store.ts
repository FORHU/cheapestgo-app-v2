import { create } from 'zustand';
import type { HotelOffer, FlightOffer, Booking } from '@/shared/types';

interface BookingState {
    // Selected offer being booked
    selectedHotelOffer: HotelOffer | null;
    selectedFlightOffer: FlightOffer | null;

    // Active bookings list (from API)
    bookings: Booking[];

    // Booking flow state
    step: 'select' | 'details' | 'payment' | 'confirmation';
    isProcessing: boolean;
    error: string | null;

    // Actions
    selectHotelOffer: (offer: HotelOffer | null) => void;
    selectFlightOffer: (offer: FlightOffer | null) => void;
    setBookings: (bookings: Booking[]) => void;
    setStep: (step: BookingState['step']) => void;
    setIsProcessing: (v: boolean) => void;
    setError: (msg: string | null) => void;
    reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
    selectedHotelOffer: null,
    selectedFlightOffer: null,
    bookings: [],
    step: 'select',
    isProcessing: false,
    error: null,

    selectHotelOffer: (offer) => set({ selectedHotelOffer: offer }),
    selectFlightOffer: (offer) => set({ selectedFlightOffer: offer }),
    setBookings: (bookings) => set({ bookings }),
    setStep: (step) => set({ step }),
    setIsProcessing: (isProcessing) => set({ isProcessing }),
    setError: (error) => set({ error }),
    reset: () => set({
        selectedHotelOffer: null,
        selectedFlightOffer: null,
        step: 'select',
        isProcessing: false,
        error: null,
    }),
}));
