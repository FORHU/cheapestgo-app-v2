import { z } from 'zod';

export const prebookSchema = z.object({
    offerId: z.string().min(1, 'Offer ID is required'),
    currency: z.string().length(3, 'Currency must be 3 characters (e.g., PHP)').optional(),
    voucherCode: z.string().optional(),
    adults: z.number().int().min(1).optional(),
    children: z.number().int().min(0).optional(),
    roomName: z.string().optional(),
});
export type PrebookInput = z.infer<typeof prebookSchema>;

export const guestSchema = z.object({
    occupancyNumber: z.number().int().positive(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email required'),
    remarks: z.string().optional(),
});

export const holderSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email required'),
});

export const bookingConfirmSchema = z.object({
    provider: z.enum(['travelgatex']).default('travelgatex'),
    prebookId: z.string().min(1, 'Prebook ID is required'),
    holder: holderSchema,
    guests: z.array(guestSchema).min(1, 'At least one guest is required'),
    payment: z.object({
        method: z.string().min(1, 'Payment method is required'),
        transactionId: z.string().optional(),
    }),
    cancellationPolicies: z.any().optional(),
    quotedPrice: z.number().positive().optional(),
});
export type BookingConfirmInput = z.infer<typeof bookingConfirmSchema>;

export const cancelBookingSchema = z.object({
    bookingId: z.string().min(1, 'Booking ID is required'),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const amendBookingSchema = z.object({
    bookingId: z.string().min(1, 'Booking ID is required'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email required'),
    remarks: z.string().optional(),
});
export type AmendBookingInput = z.infer<typeof amendBookingSchema>;
export const amendFormSchema = amendBookingSchema.omit({ bookingId: true });
export type AmendFormInput = z.infer<typeof amendFormSchema>;

export const saveBookingSchema = z.object({
    bookingId: z.string().min(1, 'Booking ID is required'),
    propertyName: z.string().min(1, 'Property name is required'),
    propertyImage: z.string().url().optional(),
    roomName: z.string().min(1, 'Room name is required'),
    checkIn: z.string().min(1, 'Check-in date is required'),
    checkOut: z.string().min(1, 'Check-out date is required'),
    adults: z.number().int().min(1, 'At least 1 adult required'),
    children: z.number().int().min(0),
    totalPrice: z.number().positive('Total price must be positive'),
    currency: z.string().length(3, 'Currency must be 3 characters'),
    holderFirstName: z.string().min(1, 'Holder first name is required'),
    holderLastName: z.string().min(1, 'Holder last name is required'),
    holderEmail: z.string().email('Valid holder email required'),
    specialRequests: z.string().optional(),
    cancellationPolicy: z.any().optional(),
});
export type SaveBookingInput = z.infer<typeof saveBookingSchema>;

export const getBookingDetailsSchema = z.object({
    bookingId: z.string().min(1, 'Booking ID is required'),
});
export type GetBookingDetailsInput = z.infer<typeof getBookingDetailsSchema>;
