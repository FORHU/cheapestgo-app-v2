import { z } from 'zod';

export const loginSchema = z.object({
    email:    z.string().email(),
    password: z.string().min(1),
});

export const registerSchema = z.object({
    email:     z.string().email(),
    password:  z.string().min(8),
    firstName: z.string().min(1).optional(),
    lastName:  z.string().min(1).optional(),
});

export const emailSchema = z.object({
    email: z.string().email(),
});

export const profileSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName:  z.string().min(1).optional(),
});

export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword:     z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput  = z.infer<typeof profileSchema>;
