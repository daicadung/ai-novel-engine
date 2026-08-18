import { generateMvpNovel, mapMvpNovelToPersistence, buildMvpInsertPlan } from '@ai-novel-engine/mvp-pipeline';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOfParam(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function numberParam(value: string | string[] | undefined, fallback: number): number {
  const raw = valueOfParam(value, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

export default async function MvpPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params = await searchParams;
  const title = valueOfParam(params.title, 'Ta La Kiem De').trim() || 'Ta La Kiem De';
  const chapterCount = numberParam(params.chapters, 50);
  const error = valueOfParam(params.error, '');
  const result = generateMvpNovel(title, { chapterCount });
  const payloads = mapMvpNovelToPersistence(result, {
    ownerId: '00000000-0000-4000-8000-000000000001',
    novelId: '00000000-0000-4000-8000-000000000002'
  });
  const insertPlan = buildMvpInsertPlan(payloads);
  const passedChecks = result.chapters.filter(chapter => chapter.continuity.pass).length;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Bộ tạo truyện MVP</p>
            <h1 className="text-2xl font-semibold tracking-tight">Từ tên truyện đến 50 chương có kiểm tra logic</h1>
            <p className="mt-1 text-sm text-zinc-600">Trang này hiển thị <strong>bản xem trước mô phỏng (Mock Data)</strong> cấu trúc truyện. Bấm <strong>Lưu vào Supabase</strong> để AI thực sự sáng tác nội dung mới.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-amber-800 text-sm mb-4">
            <strong>Lưu ý:</strong> Nội dung hiển thị bên dưới chỉ là dữ liệu tĩnh để minh họa luồng hoạt động. Khi bạn bấm <strong>Lưu vào Supabase</strong>, AI mới bắt đầu quá trình tạo ra thế giới, nhân vật và nội dung chương mới hoàn toàn.
          </div>

          <form className="flex flex-col gap-2 sm:flex-row" action="/mvp">
            <input
              aria-label="Tên truyện"
              className="h-10 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500 sm:w-80"
              name="title"
              defaultValue={title}
            />
            <input
              aria-label="Số chương"
              className="h-10 w-28 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
              name="chapters"
              type="number"
              min="1"
              max="100"
              defaultValue={chapterCount}
            />
            <button className="h-10 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" type="submit">
              Cập nhật mô phỏng
            </button>
          </form>
          <form className="flex flex-col gap-2 sm:flex-row" action="/api/mvp/save" method="post">
            <input name="title" type="hidden" value={title} />
            <input name="chapters" type="hidden" value={chapterCount} />
            {user ? (
              <button className="h-10 bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800" type="submit">
                🚀 Lưu & Sinh truyện bằng AI
              </button>
            ) : (
              <Link href="/login" className="flex items-center justify-center h-10 bg-zinc-800 px-4 text-sm font-medium text-white hover:bg-zinc-900">
                Đăng nhập để Sinh truyện
              </Link>
            )}
          </form>
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Ý tưởng</p>
            <p className="mt-2 text-sm font-medium">{result.concept.title}</p>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Số chương</p>
            <p className="mt-2 text-2xl font-semibold">{result.chapters.length}</p>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Logic truyện</p>
            <p className="mt-2 text-2xl font-semibold">{passedChecks}/{result.chapters.length}</p>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Lệnh lưu DB</p>
            <p className="mt-2 text-2xl font-semibold">{insertPlan.statements.length}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Hồ sơ truyện</h2>
            <p className="mt-3 text-sm text-zinc-700">{result.bible.bible.premise}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Thế giới</dt>
                <dd className="font-medium">{result.bible.world.name}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Nhân vật chính</dt>
                <dd className="font-medium">{result.bible.characters[0]?.name}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Dữ liệu sẽ lưu</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <span>concept_candidates</span><strong>{payloads.concept_candidates.length}</strong>
              <span>story_dna</span><strong>{payloads.story_dna.length}</strong>
              <span>chapter_outlines</span><strong>{payloads.chapter_outlines.length}</strong>
              <span>chapters</span><strong>{payloads.chapters.length}</strong>
              <span>story_events</span><strong>{payloads.story_events.length}</strong>
            </div>
          </div>
        </section>

        <section className="border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase text-zinc-500">Toàn bộ chương đã tạo</h2>
          <div className="mt-4 flex flex-col gap-4">
            {result.chapters.map(chapter => (
              <article className="border border-zinc-200 bg-zinc-50 p-4" key={chapter.memory.chapter_number}>
                <div className="flex flex-col gap-1 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-semibold">Chương {chapter.memory.chapter_number}: {chapter.draft.title}</h3>
                  <span className="text-sm text-zinc-500">
                    {chapter.continuity.pass ? 'Logic đạt' : 'Cần sửa logic'} · {chapter.memory.story_events.length} sự kiện
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{chapter.draft.content}</p>
                <p className="mt-3 text-sm text-zinc-600">
                  <strong>Tóm tắt:</strong> {chapter.draft.summary}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
