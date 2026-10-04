import { z } from 'zod';

import { OVERVIEW_RANGES } from '../utils/overview.util';

export const overviewQuerySchema = z.object({
  range: z
    .enum(OVERVIEW_RANGES, { message: 'range must be one of 7d, 30d, 90d or 12m' })
    .default('30d'),
});
