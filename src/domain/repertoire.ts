import { z } from 'zod';

export const repertoireLineSchema = z.object({
  id: z.string().min(1),
  color: z.enum(['white', 'black']),
  rootOpeningId: z.string().min(1),
  movePath: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  priority: z.number().int().nonnegative(),
  enabled: z.boolean(),
});

export type RepertoireLine = z.infer<typeof repertoireLineSchema>;
