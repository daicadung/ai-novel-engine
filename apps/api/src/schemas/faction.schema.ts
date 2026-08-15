import { z } from 'zod';
export const CreateFactionSchema = z.object({ name: z.string().min(1), goals: z.string().optional() });
export const UpdateFactionSchema = CreateFactionSchema.partial();
