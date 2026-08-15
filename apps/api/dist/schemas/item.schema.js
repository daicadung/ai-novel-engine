import { z } from 'zod';
export const CreateItemSchema = z.object({ name: z.string().min(1), description: z.string().optional() });
export const UpdateItemSchema = CreateItemSchema.partial();
