import { z } from 'zod';
export const CreateChapterSchema = z.object({ number: z.number().int(), title: z.string().optional() });
export const UpdateChapterSchema = CreateChapterSchema.partial();
