import { z } from 'zod';
export const CreateEventSchema = z.object({ title: z.string().min(1), chronologicalOrder: z.number().int().optional() });
export const UpdateEventSchema = CreateEventSchema.partial();
