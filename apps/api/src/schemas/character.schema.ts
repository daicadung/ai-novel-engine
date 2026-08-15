import { z } from 'zod';
export const CreateCharacterSchema = z.object({ name: z.string().min(1), role: z.string().optional() });
export const UpdateCharacterSchema = CreateCharacterSchema.partial();
