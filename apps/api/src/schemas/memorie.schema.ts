import { z } from 'zod';
export const CreateMemorySchema = z.object({ category: z.string(), title: z.string(), content: z.string() });
export const UpdateMemorySchema = CreateMemorySchema.partial();
