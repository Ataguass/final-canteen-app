import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  rollNumber: z.string().optional(),
  password: z.string().min(1, 'Password is required.')
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  tenantId: z.string().min(1, 'Please select a school.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits.'),
  rollNumber: z.string().min(1, 'Roll number is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.')
});

export type RegisterFormData = z.infer<typeof registerSchema>;
