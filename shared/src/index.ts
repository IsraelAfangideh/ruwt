import { z } from 'zod';

export const RunnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  personality: z.string(),
});

export type Runner = z.infer<typeof RunnerSchema>;
