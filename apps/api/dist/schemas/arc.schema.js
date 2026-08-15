import { z } from 'zod';
export const CreateArcSchema = z.object({ title: z.string().min(1), number: z.number().int() });
export const UpdateArcSchema = CreateArcSchema.partial();
