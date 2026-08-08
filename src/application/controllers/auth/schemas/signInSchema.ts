import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  password: z.string().min(1),
});

export type SignInBody = z.infer<typeof signInSchema>;
