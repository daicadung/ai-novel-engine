import { z } from 'zod';
export const CreateLocationSchema = z.object({ name: z.string().min(1), region: z.string().optional() });
export const UpdateLocationSchema = CreateLocationSchema.partial();
