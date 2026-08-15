import { z } from 'zod';
export const CreateStoryBibleSchema = z.object({ version: z.number().int().min(1), logline: z.string().optional() });
export const UpdateStoryBibleSchema = CreateStoryBibleSchema.partial();
