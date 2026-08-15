import { z } from 'zod';
export const CreateRelationshipSchema = z.object({ sourceId: z.string(), sourceType: z.string(), targetId: z.string(), targetType: z.string() });
export const UpdateRelationshipSchema = CreateRelationshipSchema.partial();
