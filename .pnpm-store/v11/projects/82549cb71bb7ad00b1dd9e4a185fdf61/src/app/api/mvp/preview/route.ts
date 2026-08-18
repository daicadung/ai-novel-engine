import { NextRequest, NextResponse } from 'next/server';
import { generateMvpOutlineWithGateway } from '@ai-novel-engine/mvp-pipeline';
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
    const title = String(body.title ?? 'Ta La Kiem De').trim() || 'Ta La Kiem De';
    const chapterCount = Number.isInteger(body.chapters) ? body.chapters : 50;

    const openAiKey = process.env.OPENAI_API_KEY;
    const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const openAiBaseUrl = process.env.OPENAI_BASE_URL;

    if (!openAiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const outline = await generateMvpOutlineWithGateway(
      title,
      new LlmGateway({ openai: new OpenAiAdapter({ apiKey: openAiKey, baseUrl: openAiBaseUrl }) }),
      { provider: 'openai', model: openAiModel, temperature: 0.8, maxTokens: 1200, timeoutMs: 85000 },
      { chapterCount, language: 'Vietnamese' }
    );

    return NextResponse.json({ outline });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error occurred' }, { status: 500 });
  }
}
