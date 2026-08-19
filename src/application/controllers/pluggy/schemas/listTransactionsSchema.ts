import { z } from 'zod';

export const listTransactionsQuerySchema = z
  .object({
    accountId: z.string().uuid().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    status: z.enum(['POSTED', 'PENDING', 'ALL']).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    sync: z.preprocess(
      val => val === 'true' || val === true || val === '1' || val === 1,
      z.boolean(),
    ).default(false),
  })
  .refine(
    data => !(data.from && data.to && new Date(data.from) > new Date(data.to)),
    {
      message: 'from date must be before or equal to to date',
      path: ['from'],
    },
  );

export type ListTransactionsQueryParams = z.infer<typeof listTransactionsQuerySchema>;
