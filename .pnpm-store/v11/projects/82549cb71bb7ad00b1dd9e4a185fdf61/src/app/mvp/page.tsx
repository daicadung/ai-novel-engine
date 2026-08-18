'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { MvpOutlineResult } from '@ai-novel-engine/mvp-pipeline';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function MvpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  const [title, setTitle] = useState('Ta La Kiem De');
  const [chapterCount, setChapterCount] = useState(1);
  const [outline, setOutline] = useState<MvpOutlineResult | null>(null);
  const [isLoadingOutline, setIsLoadingOutline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, [supabase.auth]);

  const generateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsLoadingOutline(true);
    setError('');
    setOutline(null);

    try {
      const res = await fetch('/api/mvp/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), chapters: chapterCount }),
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Lỗi máy chủ (${res.status}): Quá trình xử lý bị gián đoạn (có thể do quá thời gian/timeout). Vui lòng thử lại.`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate outline');
      }

      setOutline(data.outline);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingOutline(false);
    }
  };

  const saveAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outline) return;

    setIsSaving(true);
    setError('');

    try {
      const res = await fetch('/api/mvp/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline, chapters: chapterCount }),
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Lỗi máy chủ (${res.status}): Quá trình lưu bị gián đoạn. Vui lòng thử lại.`);
      }

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(data.error || 'Failed to save novel');
      }

      router.push(`/protected?novel=${data.novelId}`);
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Bộ tạo truyện 2 bước</p>
            <h1 className="text-2xl font-semibold tracking-tight">Tạo Khung Truyện & Sinh Nội Dung</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Nhập tiêu đề để AI sinh bộ khung truyện. Bạn có thể xem trước và duyệt trước khi lưu và sinh các chương thực tế.
            </p>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={generateOutline}>
            <input
              aria-label="Tên truyện"
              className="h-10 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500 sm:w-80"
              placeholder="Nhập tên truyện (VD: Ta Là Kiếm Đế)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoadingOutline || isSaving}
            />
            <input
              aria-label="Số chương"
              className="h-10 w-28 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
              type="number"
              min="1"
              max="100"
              value={chapterCount}
              onChange={(e) => setChapterCount(Number.parseInt(e.target.value, 10))}
              disabled={isLoadingOutline || isSaving}
            />
            <button
              className="h-10 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
              type="submit"
              disabled={isLoadingOutline || isSaving}
            >
              {isLoadingOutline ? 'Đang tạo khung...' : 'Tạo Khung Truyện'}
            </button>
          </form>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-800 text-sm mb-4">
            <strong>Lỗi:</strong> {error}
          </div>
        )}

        {outline && (
          <div className="flex flex-col gap-6 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="text-xl font-bold text-zinc-900">Bộ khung truyện đã tạo</h2>
              <form onSubmit={saveAndGenerate}>
                {user ? (
                  <button
                    className="h-10 bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800 rounded-md disabled:bg-green-300 flex items-center gap-2"
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Đang lưu & sinh chương...' : '🚀 Duyệt & Bắt đầu viết'}
                  </button>
                ) : (
                  <Link href="/login" className="flex items-center justify-center h-10 bg-zinc-800 px-4 text-sm font-medium text-white hover:bg-zinc-900 rounded-md">
                    Đăng nhập để Sinh truyện
                  </Link>
                )}
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Concept Section */}
              <div>
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Ý Tưởng (Concept)</h3>
                <div className="space-y-3 text-sm">
                  <p><strong>Tiêu đề:</strong> {outline.concept.title}</p>
                  <p><strong>Thể loại:</strong> {outline.concept.genre}</p>
                  <p><strong>Tiền đề:</strong> {outline.concept.premise}</p>
                  <p><strong>Bối cảnh:</strong> {outline.concept.setting}</p>
                  <p><strong>Xung đột:</strong> {outline.concept.conflict}</p>
                </div>
              </div>

              {/* World Bible Section */}
              <div>
                <h3 className="text-lg font-semibold text-purple-800 mb-3">Hồ sơ Thế Giới (World Bible)</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <strong>Nhân vật ({outline.bible.characters.length}):</strong>
                    <ul className="list-disc pl-5 mt-1 text-zinc-700">
                      {outline.bible.characters.map((c: any, i: number) => (
                        <li key={i}>{c.name} - <em>{c.role}</em></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Địa điểm ({outline.bible.locations.length}):</strong>
                    <ul className="list-disc pl-5 mt-1 text-zinc-700">
                      {outline.bible.locations.map((l: any, i: number) => (
                        <li key={i}>{l.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Longform Plan Section */}
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-emerald-800 mb-3">Kế Hoạch Chương (Chapter Outlines)</h3>
                <div className="space-y-4">
                  {outline.plan.chapter_outlines.map((chapter: any, index: number) => (
                    <div key={index} className="bg-zinc-50 p-4 rounded border border-zinc-200 text-sm">
                      <p className="font-semibold mb-1">Chương {chapter.chapter_number}</p>
                      <p className="text-zinc-700">{chapter.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!outline && !isLoadingOutline && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border-2 border-dashed border-zinc-200 rounded-lg">
            <svg className="w-12 h-12 mb-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p>Nhập tên truyện và bấm "Tạo Khung Truyện" để bắt đầu</p>
          </div>
        )}
      </div>
    </main>
  );
}
