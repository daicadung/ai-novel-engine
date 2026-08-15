import { z } from 'zod';
export const CreateForeshadowingSchema = z.object({ description: z.string().min(1) });
export const UpdateForeshadowingSchema = CreateForeshadowingSchema.partial();
