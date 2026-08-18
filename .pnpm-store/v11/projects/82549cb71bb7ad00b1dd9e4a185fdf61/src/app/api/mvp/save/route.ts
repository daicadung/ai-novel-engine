import { NextRequest, NextResponse } from 'next/server';
import {
  MVP_INSERT_TABLE_ORDER,
  generateChaptersForOutline,
  mapMvpNovelToPersistence,
  MvpOutlineResult
} from '@ai-novel-engine/mvp-pipeline';
import { LlmGateway, OpenAiAdapter } from '@ai-novel-engine/llm-gateway';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60; // Max allowed on Vercel Hobby

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const outline = body.outline as MvpOutlineResult;
    const chapterCount = Number.isInteger(body.chapters) ? body.chapters : 1;

    if (!outline || !outline.title) {
      return NextResponse.json({ error: 'Outline is missing or invalid' }, { status: 400 });
    }

    const novelId = crypto.randomUUID();
    const openAiKey = process.env.OPENAI_API_KEY;
    const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const openAiBaseUrl = process.env.OPENAI_BASE_URL;

    if (!openAiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const result = await generateChaptersForOutline(
      outline,
      new LlmGateway({ openai: new OpenAiAdapter({ apiKey: openAiKey, baseUrl: openAiBaseUrl }) }),
      { provider: 'openai', model: openAiModel, temperature: 0.8, maxTokens: 1200, timeoutMs: 85000 },
      { chapterCount, language: 'Vietnamese' }
    );
    
    const payloads = mapMvpNovelToPersistence(result, { ownerId: user.id, novelId });

    for (const table of MVP_INSERT_TABLE_ORDER) {
      const rows = payloads[table];
      if (rows.length === 0) continue;

      const { error } = await supabase.from(table).insert(rows);
      if (error) {
        await supabase.from('novels').delete().eq('id', novelId);
        return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, novelId });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error occurred' }, { status: 500 });
  }
}
