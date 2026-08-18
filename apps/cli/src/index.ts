#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import { LlmGateway, OpenAiAdapter } from '@ai-novel-engine/llm-gateway';
import * as crypto from 'crypto';

const program = new Command();

program
  .name('ai-novel')
  .description('AI Novel Engine CLI for generating novels locally')
  .version('0.1.0');

async function getSupabaseAndOwner() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Lỗi: Chưa cấu hình SUPABASE_URL và SUPABASE_ANON_KEY trong file .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  let ownerId = process.env.OWNER_ID;

  if (email && password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('❌ Lỗi đăng nhập:', error.message);
      process.exit(1);
    }
    ownerId = data.user.id;
  } else if (!ownerId) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error || !users || users.length === 0) {
      console.error('❌ Lỗi: Không tìm thấy người dùng nào trong Supabase.');
      process.exit(1);
    }
    ownerId = users[0].id;
  }
  return { supabase, ownerId };
}

function getGatewayAndConfig() {
  const openAiKey = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const openAiBaseUrl = process.env.OPENAI_BASE_URL;

  if (!openAiKey) {
    console.error('❌ Lỗi: Chưa cấu hình OPENAI_API_KEY trong file .env');
    process.exit(1);
  }

  const gateway = new LlmGateway({ openai: new OpenAiAdapter({ apiKey: openAiKey as string, baseUrl: openAiBaseUrl }) });
  const writerConfig = { provider: 'openai' as const, model: openAiModel, temperature: 0.8, maxTokens: 16000, timeoutMs: 300000 };
  
  return { gateway, writerConfig };
}

program
  .command('new')
  .description('Generate a new novel')
  .argument('<title>', 'Title of the novel')
  .option('-c, --chapters <number>', 'Number of chapters to generate', '1')
  .option('--language <string>', 'Language of the novel', 'Vietnamese')
  .action(async (title, options) => {
    try {
      console.log(`\n🚀 Bắt đầu tạo truyện mới: "${title}"`);
      const { supabase, ownerId } = await getSupabaseAndOwner();
      const { gateway, writerConfig } = getGatewayAndConfig();
      const chapterCount = parseInt(options.chapters, 10);

      const { ConceptEngine } = await import('@ai-novel-engine/concept-engine');
      const { StoryArchitect } = await import('@ai-novel-engine/story-architect');
      const { LongformPlanner } = await import('@ai-novel-engine/longform-planner');
      const { ChapterWriter } = await import('@ai-novel-engine/chapter-writer');
      const { MemoryExtractor, ContinuityChecker } = await import('@ai-novel-engine/memory-continuity');
      const { mapMvpNovelToPersistence, mapSingleChapterToPersistence, MVP_INSERT_TABLE_ORDER, buildInitialSnapshot, buildWriterContext, applyMemory } = await import('@ai-novel-engine/mvp-pipeline');

      console.log('🧠 [1/2] Đang thiết kế Khung Truyện...');
      const conceptEngine = new ConceptEngine(gateway, { ...writerConfig, provider: 'openai' });
      const conceptResult = await conceptEngine.generateConcepts(title);
      const concept = conceptResult.candidates[0];
      if (!concept) throw new Error('Không thể tạo concept');
      
      const dna = await conceptEngine.extractStoryDna(concept);
      const architect = new StoryArchitect(gateway, { ...writerConfig, provider: 'openai' });
      const bibleResult = await architect.generateStoryBible({
        title, concept, dna, language: options.language,
        onProgress: (msg) => console.log(`      ↳ ${msg}`),
      });
      const bible = bibleResult.draft;
      
      const planner = new LongformPlanner();
      const plan = planner.plan(
        { title, bible },
        { targetChapters: chapterCount, targetArcs: Math.min(3, chapterCount), seed: title }
      );
      
      const outline = { title, concept, dna, bible, plan };
      console.log('✅ Đã tạo xong Khung Truyện!');

      const novelId = crypto.randomUUID();
      const outlinePayloads = mapMvpNovelToPersistence({ ...outline, chapters: [] }, { ownerId: ownerId as string, novelId });
      
      for (const table of MVP_INSERT_TABLE_ORDER) {
        const rows = outlinePayloads[table];
        if (rows && rows.length > 0) {
          const { error } = await supabase.from(table).insert(rows);
          if (error) throw new Error(`Lỗi lưu bảng ${table}: ${error.message}`);
        }
      }

      console.log('\n✍️ [2/2] Đang viết nội dung chi tiết...');
      const writer = new ChapterWriter(gateway);
      const extractor = new MemoryExtractor(gateway);
      const checker = new ContinuityChecker();
      
      const chapters: any[] = [];
      const summaries: string[] = [];
      const snapshot = buildInitialSnapshot(outline.bible);

      for (const target_outline of outline.plan.chapter_outlines) {
        console.log(`   ➤ Đang viết Chương ${target_outline.chapter_number}...`);
        const context = buildWriterContext(target_outline, summaries, outline.bible, outline.plan, options.language);
        const draft = await writer.write(context, writerConfig);
        
        const memory = await extractor.extract(draft, target_outline.chapter_number, {
          provider: writerConfig.provider, model: writerConfig.model, temperature: 0.2, maxTokens: 800,
        });
        const continuity = checker.check(draft, memory, snapshot);
        
        chapters.push({ draft, memory, continuity });
        summaries.push(draft.summary);
        applyMemory(snapshot, memory);
        
        const novelResult = { ...outline, chapters };
        const chapterPayloads = mapSingleChapterToPersistence(novelResult, chapters.length - 1, { novelId });
        
        for (const table of MVP_INSERT_TABLE_ORDER) {
          const rows = chapterPayloads[table as keyof typeof chapterPayloads];
          if (rows && rows.length > 0) {
            await supabase.from(table).insert(rows);
          }
        }
        console.log(`      ✅ Xong Chương ${target_outline.chapter_number}`);
      }
      
      console.log(`🎉 HOÀN TẤT!`);
    } catch (error: any) {
      console.error('\n❌ Lỗi hệ thống:', error.message || error);
    }
  });

program
  .command('continue')
  .description('Tìm và viết tiếp truyện đang đánh dấu continue')
  .action(async () => {
    try {
      const { supabase, ownerId } = await getSupabaseAndOwner();
      const { gateway, writerConfig } = getGatewayAndConfig();
      
      console.log('🔍 Đang tìm truyện cần viết tiếp...');
      // Cannot easily filter jsonb via eq natively in simple syntax, so fetch and filter or use raw SQL.
      // But we can fetch active novels and check.
      const { data: novels, error } = await supabase.from('novels').select('*').eq('owner_id', ownerId).eq('status', 'active');
      if (error) throw new Error(error.message);
      
      const novel = novels.find(n => n.metadata && n.metadata.pending_action === 'continue');
      if (!novel) {
        console.log('Không có truyện nào đang chờ viết tiếp.');
        return;
      }
      
      console.log(`\n🚀 Phục hồi tiến trình viết truyện: "${novel.title}"`);
      const outline = novel.metadata.outline;
      if (!outline) throw new Error('Không tìm thấy dữ liệu Outline trong metadata của truyện!');
      
      const { data: chaptersData, error: chError } = await supabase
        .from('chapters')
        .select('*')
        .eq('novel_id', novel.id)
        .order('chapter_number', { ascending: true });
        
      if (chError) throw new Error(chError.message);
      
      const { ChapterWriter } = await import('@ai-novel-engine/chapter-writer');
      const { MemoryExtractor, ContinuityChecker } = await import('@ai-novel-engine/memory-continuity');
      const { mapSingleChapterToPersistence, MVP_INSERT_TABLE_ORDER, buildInitialSnapshot, buildWriterContext, applyMemory } = await import('@ai-novel-engine/mvp-pipeline');

      const writer = new ChapterWriter(gateway);
      const extractor = new MemoryExtractor(gateway);
      const checker = new ContinuityChecker();
      
      const chapters: any[] = [];
      const summaries: string[] = [];
      const snapshot = buildInitialSnapshot(outline.bible);
      
      console.log(`🧠 Đang tái tạo Trí nhớ từ ${chaptersData.length} chương đã viết...`);
      for (const ch of chaptersData) {
        if (!ch.metadata || !ch.metadata.memory) {
          console.warn(`⚠️ Chương ${ch.chapter_number} không có dữ liệu memory. Trí nhớ có thể bị khuyết.`);
        } else {
          applyMemory(snapshot, ch.metadata.memory);
          chapters.push({ draft: { chapter_number: ch.chapter_number, title: ch.title, content: ch.content, summary: ch.summary, word_count: 0 }, memory: ch.metadata.memory, continuity: {} });
        }
        summaries.push(ch.summary);
      }
      
      const nextChapterNum = chaptersData.length + 1;
      const remainingOutlines = outline.plan.chapter_outlines.filter((o: any) => o.chapter_number >= nextChapterNum);
      
      if (remainingOutlines.length === 0) {
        console.log('Truyện đã hoàn thành, không còn chương nào để viết!');
        // Clear flag
        novel.metadata.pending_action = null;
        await supabase.from('novels').update({ metadata: novel.metadata }).eq('id', novel.id);
        return;
      }
      
      console.log(`\n✍️ Bắt đầu viết từ Chương ${nextChapterNum}...`);
      for (const target_outline of remainingOutlines) {
        console.log(`   ➤ Đang viết Chương ${target_outline.chapter_number}...`);
        const context = buildWriterContext(target_outline, summaries, outline.bible, outline.plan, novel.language || 'Vietnamese');
        const draft = await writer.write(context, writerConfig);
        
        const memory = await extractor.extract(draft, target_outline.chapter_number, {
          provider: writerConfig.provider, model: writerConfig.model, temperature: 0.2, maxTokens: 800,
        });
        const continuity = checker.check(draft, memory, snapshot);
        
        chapters.push({ draft, memory, continuity });
        summaries.push(draft.summary);
        applyMemory(snapshot, memory);
        
        const novelResult = { ...outline, chapters };
        const chapterPayloads = mapSingleChapterToPersistence(novelResult, chapters.length - 1, { novelId: novel.id });
        
        for (const table of MVP_INSERT_TABLE_ORDER) {
          const rows = chapterPayloads[table as keyof typeof chapterPayloads];
          if (rows && rows.length > 0) {
            await supabase.from(table).insert(rows);
          }
        }
        console.log(`      ✅ Xong Chương ${target_outline.chapter_number}`);
      }
      
      novel.metadata.pending_action = null;
      await supabase.from('novels').update({ metadata: novel.metadata }).eq('id', novel.id);
      console.log(`🎉 HOÀN TẤT!`);
      
    } catch (error: any) {
      console.error('\n❌ Lỗi hệ thống:', error.message || error);
    }
  });

program
  .command('edit')
  .description('Tìm truyện đánh dấu edit, xoá từ chương đích và viết lại')
  .action(async () => {
    try {
      const { supabase, ownerId } = await getSupabaseAndOwner();
      const { gateway, writerConfig } = getGatewayAndConfig();
      
      console.log('🔍 Đang tìm truyện cần viết lại...');
      const { data: novels, error } = await supabase.from('novels').select('*').eq('owner_id', ownerId).eq('status', 'active');
      if (error) throw new Error(error.message);
      
      const novel = novels.find(n => n.metadata && n.metadata.pending_action === 'edit');
      if (!novel) {
        console.log('Không có truyện nào đang chờ viết lại.');
        return;
      }
      
      const targetChapter = novel.metadata.target_chapter;
      if (!targetChapter) throw new Error('Không tìm thấy target_chapter trong metadata.');
      
      console.log(`\n🗑️ Xoá dữ liệu từ Chương ${targetChapter} trở đi của truyện: "${novel.title}"...`);
      // Delete chapters >= targetChapter
      await supabase.from('chapters').delete().eq('novel_id', novel.id).gte('chapter_number', targetChapter);
      
      // Update pending_action to continue
      novel.metadata.pending_action = 'continue';
      delete novel.metadata.target_chapter;
      await supabase.from('novels').update({ metadata: novel.metadata }).eq('id', novel.id);
      
      console.log(`✅ Đã dọn dẹp xong. Chuyển sang chế độ viết tiếp (continue)...`);
      // Re-run continue natively? Wait, it's a CLI app. We can just execute the logic or tell the user to run continue.
      // But we can also just run it inline. But since it's a separate command, we can just log:
      console.log('Vui lòng chạy `pnpm cli continue` để bắt đầu viết lại!');
      
    } catch (error: any) {
      console.error('\n❌ Lỗi hệ thống:', error.message || error);
    }
  });

program.parse();
