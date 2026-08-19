import { z } from 'zod';

export const getTransactionsSummaryQuerySchema = z
  .object({
    accountId: z.string().uuid().optional(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (expected YYYY-MM)').optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    status: z.enum(['POSTED', 'PENDING', 'ALL']).optional(),
  })
  .refine(
    data => !(data.from && data.to && new Date(data.from) > new Date(data.to)),
    {
      message: 'from date must be before or equal to to date',
      path: ['from'],
    },
  )
  .refine(
    data => !(data.month && (data.from || data.to)),
    {
      message: 'Cannot provide both month and custom from/to range',
      path: ['month'],
    },
  );

export type GetTransactionsSummaryQueryParams = z.infer<typeof getTransactionsSummaryQuerySchema>;
