import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  acceptedTerms: z.literal(true),
});

export type SignUpBody = z.infer<typeof signUpSchema>;
