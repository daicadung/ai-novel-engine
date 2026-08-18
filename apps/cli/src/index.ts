#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import {
  generateMvpOutlineWithGateway,
  generateChaptersForOutline,
  mapMvpNovelToPersistence,
  MVP_INSERT_TABLE_ORDER
} from '@ai-novel-engine/mvp-pipeline';
import { LlmGateway, OpenAiAdapter } from '@ai-novel-engine/llm-gateway';
import * as crypto from 'crypto';

const program = new Command();

program
  .name('ai-novel')
  .description('AI Novel Engine CLI for generating novels locally')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate a new novel')
  .argument('<title>', 'Title of the novel')
  .option('-c, --chapters <number>', 'Number of chapters to generate', '1')
  .option('--language <string>', 'Language of the novel', 'Vietnamese')
  .action(async (title, options) => {
    try {
      console.log(`\n🚀 Bắt đầu quá trình tạo truyện: "${title}"`);
      console.log(`Số chương: ${options.chapters} | Ngôn ngữ: ${options.language}\n`);

      const openAiKey = process.env.OPENAI_API_KEY;
      const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
      const openAiBaseUrl = process.env.OPENAI_BASE_URL;

      if (!openAiKey) {
        console.error('❌ Lỗi: Chưa cấu hình OPENAI_API_KEY trong file .env');
        process.exit(1);
      }

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
        console.log('Đang đăng nhập vào Supabase...');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error('❌ Lỗi đăng nhập:', error.message);
          process.exit(1);
        }
        ownerId = data.user.id;
        console.log('✅ Đăng nhập thành công.');
      } else if (!ownerId) {
        console.log('Đang tìm kiếm người dùng tự động qua Service Role Key...');
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error || !users || users.length === 0) {
          console.error('❌ Lỗi: Không tìm thấy người dùng nào trong Supabase. Vui lòng tạo tài khoản trên web trước hoặc cung cấp SUPABASE_EMAIL trong .env');
          process.exit(1);
        }
        ownerId = users[0].id;
        console.log(`✅ Đã tự động gán truyện cho người dùng: ${users[0].email} (${ownerId})`);
      }

      console.log('\n🧠 [1/2] Đang gọi OpenAI để thiết kế Khung Truyện (Ý tưởng, Nhân vật, Bản đồ)...');
      const { ConceptEngine } = await import('@ai-novel-engine/concept-engine');
      const { StoryArchitect } = await import('@ai-novel-engine/story-architect');
      const { LongformPlanner } = await import('@ai-novel-engine/longform-planner');
      const { ChapterWriter } = await import('@ai-novel-engine/chapter-writer');
      
      const gateway = new LlmGateway({ openai: new OpenAiAdapter({ apiKey: openAiKey as string, baseUrl: openAiBaseUrl }) });
      const writerConfig = { provider: 'openai' as const, model: openAiModel, temperature: 0.8, maxTokens: 4000, timeoutMs: 300000 };
      
      console.log('   ➤ Bước 1.1: Đang sáng tạo các Concept truyện (Ý tưởng lõi)...');
      const conceptEngine = new ConceptEngine(gateway, { ...writerConfig, provider: 'openai' });
      const conceptResult = await conceptEngine.generateConcepts(title);
      const concept = conceptResult.candidates[0];
      if (!concept) throw new Error('Không thể tạo concept');
      
      console.log(`   ➤ Bước 1.2: Đang trích xuất Story DNA từ Concept "${concept.title}"...`);
      const dna = await conceptEngine.extractStoryDna(concept);
      
      console.log('   ➤ Bước 1.3: Đang xây dựng Story Bible (Hồ sơ thế giới, Nhân vật, Hệ thống sức mạnh)...');
      const architect = new StoryArchitect(gateway, { ...writerConfig, provider: 'openai' });
      const bibleResult = await architect.generateStoryBible({
        title,
        concept,
        dna,
        language: options.language,
        onProgress: (msg) => console.log(`      ↳ ${msg}`),
      });
      const bible = bibleResult.draft;
      
      console.log('   ➤ Bước 1.4: Đang lên Kế Hoạch Dài Hạn (Longform Planner) cho từng chương...');
      const planner = new LongformPlanner();
      const plan = planner.plan(
        { title, bible },
        { targetChapters: parseInt(options.chapters, 10), targetArcs: Math.min(3, parseInt(options.chapters, 10)), seed: title }
      );
      
      const outline = { title, concept, dna, bible, plan };

      console.log('✅ Đã tạo xong Khung Truyện!');
      console.log(`   - Thể loại: ${outline.concept.genre}`);
      console.log(`   - Nhân vật: ${outline.bible.characters.map((c: any) => c.name).join(', ')}`);

      console.log('\n💾 Đang lưu Khung Truyện vào Supabase...');
      const novelId = crypto.randomUUID();
      const { mapMvpNovelToPersistence, mapSingleChapterToPersistence, MVP_INSERT_TABLE_ORDER } = await import('@ai-novel-engine/mvp-pipeline');
      
      const outlinePayloads = mapMvpNovelToPersistence({ ...outline, chapters: [] }, { ownerId: ownerId as string, novelId });
      
      for (const table of MVP_INSERT_TABLE_ORDER) {
        const rows = outlinePayloads[table];
        if (rows && rows.length > 0) {
          const { error } = await supabase.from(table).insert(rows);
          if (error) {
            console.error(`❌ Lỗi khi lưu Khung Truyện vào bảng ${table}:`, error.message);
            process.exit(1);
          }
        }
      }
      console.log('✅ Đã lưu Khung Truyện thành công!');

      console.log('\n✍️ [2/2] Đang viết nội dung chi tiết cho từng chương...');
      const chapterCount = parseInt(options.chapters, 10);
      
      // Inline generateChaptersForOutline with progress logs
      const { MemoryExtractor, ContinuityChecker } = await import('@ai-novel-engine/memory-continuity');
      
      const writer = new ChapterWriter(gateway);
      const extractor = new MemoryExtractor(gateway);
      const checker = new ContinuityChecker();
      
      const chapters = [];
      const summaries = [];
      
      const { buildInitialSnapshot, buildWriterContext, applyMemory } = await import('@ai-novel-engine/mvp-pipeline');
      
      const snapshot = buildInitialSnapshot(outline.bible);
      for (const target_outline of outline.plan.chapter_outlines) {
        console.log(`   ➤ Đang viết Chương ${target_outline.chapter_number}: ${target_outline.title}...`);
        
        const context = buildWriterContext(target_outline, summaries, outline.bible, outline.plan, options.language);
        const draft = await writer.write(context, writerConfig);
        
        console.log(`      ↳ Đang trích xuất dữ liệu trí nhớ cho chương...`);
        const memory = await extractor.extract(draft, target_outline.chapter_number, {
          provider: writerConfig.provider,
          model: writerConfig.model,
          temperature: 0.2,
          maxTokens: 800,
        });
        
        console.log(`      ↳ Kiểm tra tính logic, liên tục của cốt truyện...`);
        const continuity = checker.check(draft, memory, snapshot);
        
        chapters.push({ draft, memory, continuity });
        summaries.push(draft.summary);
        applyMemory(snapshot, memory);
        
        console.log(`      ↳ Đang lưu Chương ${target_outline.chapter_number} lên Supabase...`);
        const novelResult = { ...outline, chapters };
        const chapterPayloads = mapSingleChapterToPersistence(novelResult, chapters.length - 1, { novelId });
        
        for (const table of MVP_INSERT_TABLE_ORDER) {
          const rows = chapterPayloads[table as keyof typeof chapterPayloads];
          if (rows && rows.length > 0) {
            const { error } = await supabase.from(table).insert(rows);
            if (error) {
              console.error(`❌ Lỗi khi lưu bảng ${table} cho Chương ${target_outline.chapter_number}:`, error.message);
              // Lỗi 1 phần không nên crash chương trình, log lại và chạy tiếp
            }
          }
        }
        
        console.log(`      ✅ Xong Chương ${target_outline.chapter_number} (${draft.word_count} chữ). Đã sao lưu Cloud!`);
      }
      
      console.log('✅ Đã viết xong tất cả các chương!');

      console.log(`🎉 HOÀN TẤT! Truyện đã được lưu vào database.`);
      console.log(`Mở trình duyệt vào Vercel (hoặc localhost) trang /protected?novel=${novelId} để xem.`);

    } catch (error: any) {
      console.error('\n❌ Lỗi hệ thống:', error.message || error);
    }
  });

program.parse();
