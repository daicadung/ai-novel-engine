import { NextRequest, NextResponse } from 'next/server';
import {
  MVP_INSERT_TABLE_ORDER,
  generateMvpNovel,
  mapMvpNovelToPersistence
} from '@ai-novel-engine/mvp-pipeline';
import { createClient } from '@/utils/supabase/server';

function numberParam(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const title = String(formData.get('title') ?? 'Ta La Kiem De').trim() || 'Ta La Kiem De';
  const chapterCount = numberParam(formData.get('chapters'), 50);
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }

  const novelId = crypto.randomUUID();
  const result = generateMvpNovel(title, { chapterCount });
  const payloads = mapMvpNovelToPersistence(result, { ownerId: user.id, novelId });

  for (const table of MVP_INSERT_TABLE_ORDER) {
    const rows = payloads[table];
    if (rows.length === 0) continue;

    const { error } = await supabase.from(table).insert(rows);
    if (error) {
      await supabase.from('novels').delete().eq('id', novelId);
      return NextResponse.redirect(new URL(`/mvp?error=${encodeURIComponent(`${table}: ${error.message}`)}`, request.url), 303);
    }
  }

  return NextResponse.redirect(new URL(`/protected?novel=${novelId}`, request.url), 303);
}
