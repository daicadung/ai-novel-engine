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
        console.error('❌ Lỗi: Phải cung cấp SUPABASE_EMAIL/SUPABASE_PASSWORD hoặc OWNER_ID trong file .env');
        process.exit(1);
      }

      console.log('\n🧠 [1/2] Đang gọi OpenAI để thiết kế Khung Truyện (Ý tưởng, Nhân vật, Bản đồ)...');
      console.log('Vui lòng đợi vài chục giây...');
      const gateway = new LlmGateway({ openai: new OpenAiAdapter({ apiKey: openAiKey, baseUrl: openAiBaseUrl }) });
      
      const outline = await generateMvpOutlineWithGateway(
        title,
        gateway,
        { provider: 'openai', model: openAiModel, temperature: 0.8, maxTokens: 1200, timeoutMs: 300000 },
        { chapterCount: parseInt(options.chapters, 10), language: options.language }
      );

      console.log('✅ Đã tạo xong Khung Truyện!');
      console.log(`   - Thể loại: ${outline.concept.genre}`);
      console.log(`   - Nhân vật: ${outline.bible.characters.map((c: any) => c.name).join(', ')}`);

      console.log('\n✍️ [2/2] Đang viết nội dung chi tiết cho từng chương...');
      const novelResult = await generateChaptersForOutline(
        outline,
        gateway,
        { provider: 'openai', model: openAiModel, temperature: 0.8, maxTokens: 1200, timeoutMs: 300000 },
        { chapterCount: parseInt(options.chapters, 10), language: options.language }
      );

      console.log('✅ Đã viết xong tất cả các chương!');

      console.log('\n💾 Đang lưu vào Supabase...');
      const novelId = crypto.randomUUID();
      const payloads = mapMvpNovelToPersistence(novelResult, { ownerId: ownerId as string, novelId });

      for (const table of MVP_INSERT_TABLE_ORDER) {
        const rows = payloads[table];
        if (rows.length === 0) continue;

        const { error } = await supabase.from(table).insert(rows);
        if (error) {
          console.error(`❌ Lỗi khi lưu vào bảng ${table}:`, error.message);
          await supabase.from('novels').delete().eq('id', novelId);
          process.exit(1);
        }
      }

      console.log(`🎉 HOÀN TẤT! Truyện đã được lưu vào database.`);
      console.log(`Mở trình duyệt vào Vercel (hoặc localhost) trang /protected?novel=${novelId} để xem.`);

    } catch (error: any) {
      console.error('\n❌ Lỗi hệ thống:', error.message || error);
    }
  });

program.parse();
