import { z } from 'zod';
export const CreatePlotThreadSchema = z.object({ title: z.string().min(1), description: z.string() });
export const UpdatePlotThreadSchema = CreatePlotThreadSchema.partial();
