import { z } from 'zod';
import { isFreeProviderEmail } from './email-validation';

// Frontend-only validation. Backend validates again on submit — these
// schemas are for fast UX feedback in the form, not the security boundary.

export const emailSchema = z.string().trim().email('Enter a valid email address.');
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'That is too long.');

// On signup we additionally reject free / disposable mail providers — the
// app is targeted at organisations and we want the user's company domain
// for tenancy. Sign-in stays lenient so legacy accounts can still log in.
export const workEmailSchema = emailSchema.refine(
  (email) => !isFreeProviderEmail(email),
  'Please use your company or organisation email address.',
);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z
  .object({
    email: workEmailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type SessionUser = {
  id: string;
  email: string;
  company_domain: string;
};
