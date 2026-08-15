import { z } from 'zod';
import { NovelStatus } from '@prisma/client';
export const CreateNovelSchema = z.object({
    title: z.string().min(1),
    premise: z.string().optional(),
    language: z.string().default("vi"),
    genre: z.string().optional(),
    tone: z.string().optional(),
    targetChapters: z.number().int().positive().optional(),
    chapterWordGoal: z.number().int().positive().optional(),
});
export const UpdateNovelSchema = CreateNovelSchema.partial().extend({
    status: z.nativeEnum(NovelStatus).optional()
});
