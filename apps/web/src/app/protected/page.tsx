import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, status, target_chapter_count, created_at')
    .order('created_at', { ascending: false })

  const firstNovel = novels?.[0]
  const { count: chapterCount } = firstNovel
    ? await supabase
      .from('chapters')
      .select('id', { count: 'exact', head: true })
      .eq('novel_id', firstNovel.id)
    : { count: 0 }
  const { data: chapters } = firstNovel
    ? await supabase
      .from('chapters')
      .select('chapter_number, title, content, summary')
      .eq('novel_id', firstNovel.id)
      .order('chapter_number', { ascending: true })
    : { data: [] }

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-zinc-950 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-4">
          <p className="text-sm text-zinc-500">Đang đăng nhập bằng {user.email}</p>
          <h1 className="mt-1 text-2xl font-semibold">Truyện của bạn</h1>
        </header>

        {firstNovel ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="border border-zinc-200 bg-white p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase text-zinc-500">Truyện vừa lưu</p>
              <h2 className="mt-2 text-xl font-semibold">{firstNovel.title}</h2>
              <p className="mt-2 text-sm text-zinc-600">Trạng thái: {firstNovel.status}</p>
            </div>
            <div className="border border-zinc-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase text-zinc-500">Chương đã lưu</p>
              <p className="mt-2 text-3xl font-semibold">{chapterCount ?? 0}</p>
              <p className="text-sm text-zinc-500">Mục tiêu {firstNovel.target_chapter_count}</p>
            </div>
          </section>
        ) : (
          <p className="border border-zinc-200 bg-white p-4">Chưa có truyện đã lưu.</p>
        )}

        {novels && novels.length > 0 ? (
          <section className="border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Danh sách truyện đã lưu</h2>
            <ul className="mt-3 divide-y divide-zinc-100">
              {novels.map((novel) => (
                <li className="flex justify-between py-3 text-sm" key={novel.id}>
                  <span className="font-medium">{novel.title}</span>
                  <span className="text-zinc-500">{novel.target_chapter_count} chapters</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          null
        )}

        {chapters && chapters.length > 0 ? (
          <section className="border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Nội dung chương đã lưu</h2>
            <div className="mt-4 flex flex-col gap-4">
              {chapters.map((chapter) => (
                <article className="border border-zinc-200 bg-zinc-50 p-4" key={chapter.chapter_number}>
                  <h3 className="font-semibold">Chương {chapter.chapter_number}: {chapter.title}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{chapter.content}</p>
                  <p className="mt-3 text-sm text-zinc-600"><strong>Tóm tắt:</strong> {chapter.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
