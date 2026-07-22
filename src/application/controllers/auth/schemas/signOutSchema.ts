import { z } from 'zod';

export const signOutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type SignOutBody = z.infer<typeof signOutSchema>;
