import { z } from 'zod';

export const helloWorldSchema = z.object({
  name: z.string().optional(),
});

export type HelloWorldBody = z.infer<typeof helloWorldSchema>;
