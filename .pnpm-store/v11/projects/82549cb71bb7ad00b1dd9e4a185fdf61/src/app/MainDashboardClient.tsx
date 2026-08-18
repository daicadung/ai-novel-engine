'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { normalizeText } from '@/utils/text'
import { deleteNovel, setPendingAction, createNewNovel } from './actions/novel'

function viStatus(status: string): string {
  if (!status) return ''
  return ({
    active: 'đang chạy',
    alive: 'còn sống',
    approved: 'đã duyệt',
    completed: 'hoàn tất',
    dead: 'đã chết',
    drafting: 'đang nháp',
    healthy: 'ổn định'
  } as Record<string, string>)[status] ?? status
}

export default function MainDashboardClient({ 
  novels, 
  currentNovel,
  chapters,
  characters,
  arcs,
  storyBible,
  worldRulesCount
}: any) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSettingAction, setIsSettingAction] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newChapters, setNewChapters] = useState(10)
  const [newLanguage, setNewLanguage] = useState('Vietnamese')
  const [isCreating, setIsCreating] = useState(false)

  // Categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    novels.forEach((n: any) => {
      if (n.genre) cats.add(normalizeText(n.genre))
    })
    return ['Tất cả', ...Array.from(cats)]
  }, [novels])

  const filteredNovels = useMemo(() => {
    if (selectedCategory === 'Tất cả') return novels
    return novels.filter((n: any) => normalizeText(n.genre) === selectedCategory)
  }, [novels, selectedCategory])

  const handleDelete = async () => {
    if (!currentNovel) return
    if (confirm('Bạn có chắc chắn muốn xóa bộ truyện này không? Toàn bộ dữ liệu sẽ bị mất vĩnh viễn.')) {
      setIsDeleting(true)
      try {
        await deleteNovel(currentNovel.id)
      } catch (err) {
        console.error(err)
        alert('Có lỗi xảy ra khi xóa truyện.')
        setIsDeleting(false)
      }
    }
  }

  const handlePendingAction = async (action: 'continue' | 'edit', targetChapter?: number) => {
    if (!currentNovel) return
    let confirmMsg = action === 'continue' ? 'Bạn có muốn đánh dấu truyện này để viết tiếp không?' : `Bạn có chắc muốn xoá dữ liệu từ chương ${targetChapter} và viết lại không?`
    if (confirm(confirmMsg)) {
      setIsSettingAction(true)
      try {
        await setPendingAction(currentNovel.id, action, targetChapter)
        alert('Đã đánh dấu thành công! Hãy chạy CLI để tiếp tục.')
      } catch (err) {
        console.error(err)
        alert('Có lỗi xảy ra.')
      } finally {
        setIsSettingAction(false)
      }
    }
  }

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsCreating(true)
    try {
      await createNewNovel(newTitle.trim(), newChapters, newLanguage)
      setIsCreateModalOpen(false)
      setNewTitle('')
      setNewChapters(10)
    } catch (err) {
      console.error(err)
      alert('Có lỗi xảy ra khi tạo truyện.')
    } finally {
      setIsCreating(false)
    }
  }

  // Mock data for costs & logic
  const mockCost = { totalTokens: 1250000, estimatedCostUsd: 14.50, model: 'claude-3-5-sonnet', provider: 'anthropic' }
  const mockLogic = [
    { severity: 'minor', description: 'Cần cập nhật log kiểm tra nhân vật.' },
    { severity: 'major', description: 'Chưa thấy cập nhật mới về luật thế giới.' }
  ]

  const progress = currentNovel && currentNovel.target_chapter_count > 0 
    ? chapters.length / currentNovel.target_chapter_count 
    : 0

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Máy tạo truyện AI</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Truyện hiện tại: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentNovel ? normalizeText(currentNovel.title) : 'Chưa có'}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            + Tạo truyện mới
          </button>
        </div>
      </header>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Tạo truyện mới</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateNew} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên truyện</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Nhập tên truyện..."
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số chương mục tiêu</label>
                <input 
                  type="number" 
                  value={newChapters}
                  onChange={e => setNewChapters(parseInt(e.target.value) || 1)}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ngôn ngữ</label>
                <select 
                  value={newLanguage}
                  onChange={e => setNewLanguage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Vietnamese">Tiếng Việt</option>
                  <option value="English">Tiếng Anh</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-md"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating || !newTitle.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                >
                  {isCreating ? 'Đang tạo...' : 'Lưu lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Mobile Navbar / Categories */}
        <div className="col-span-1 lg:col-span-12 block lg:hidden border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`whitespace-nowrap px-3 py-1 text-sm rounded-full border ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Left - novels list */}
        <div className="col-span-1 lg:col-span-3 flex flex-col gap-6 order-2 lg:order-1">
          <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex justify-between items-center">
              Danh sách truyện
            </h2>
            
            <div className="hidden lg:flex gap-2 mb-4 flex-wrap">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  className={`px-2 py-0.5 text-xs rounded-full border ${selectedCategory === cat ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredNovels.length > 0 ? filteredNovels.map((novel: any) => (
                <Link 
                  key={novel.id} 
                  href={`/?novel=${novel.id}`} 
                  className={`block border rounded p-3 transition-colors ${currentNovel?.id === novel.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300'}`}
                >
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {novel.metadata?.pending_action === 'new' && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                    )}
                    {normalizeText(novel.title)}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{novel.target_chapter_count} chương</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {novel.metadata?.pending_action ? 'Đang chờ xử lý' : viStatus(novel.status)}
                    </span>
                  </div>
                </Link>
              )) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">Không có truyện nào.</p>
              )}
            </div>
          </section>

          {currentNovel && (
            <>
              <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Luồng tạo truyện</h2>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Trạng thái</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    ổn định
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Tiến độ (Ch {chapters.length}/{currentNovel.target_chapter_count})</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, progress * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Chi phí (Ước tính)</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Total Tokens</span>
                    <span className="font-mono">{mockCost.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Chi phí ước tính</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">${mockCost.estimatedCostUsd.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Model: {mockCost.model} ({mockCost.provider})</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Main Content Column */}
        <div className="col-span-1 lg:col-span-9 flex flex-col gap-6 order-1 lg:order-2">
          {currentNovel ? (
            <>
              {/* Action Bar */}
              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
                <div>
                  {currentNovel.metadata?.pending_action && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      Đang chờ CLI xử lý: {currentNovel.metadata.pending_action} {currentNovel.metadata.target_chapter ? `(Chương ${currentNovel.metadata.target_chapter})` : ''}
                    </span>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  {chapters.length < currentNovel.target_chapter_count && !currentNovel.metadata?.pending_action && (
                    <button 
                      onClick={() => handlePendingAction('continue')}
                      disabled={isSettingAction}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isSettingAction ? 'Đang đánh dấu...' : '▶️ Tiếp tục viết'}
                    </button>
                  )}
                  <button 
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 px-4 py-2 rounded-md text-sm font-medium transition-colors border border-red-200 dark:border-red-800/50"
                  >
                    {isDeleting ? 'Đang xóa...' : '🗑️ Xóa truyện'}
                  </button>
                  <Link 
                    href={`/protected/novel/${currentNovel.id}/read`}
                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-6 py-2 rounded-md text-sm font-semibold transition-colors"
                  >
                    📖 Đọc Truyện
                  </Link>
                </div>
              </div>

              {/* Top Row in Main */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Hồ sơ truyện</h2>
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">{normalizeText(storyBible?.genre || 'Chưa phân loại')}</span>
                  </div>
                  <p className="text-sm italic mb-3 text-zinc-700 dark:text-zinc-300">&quot;{normalizeText(storyBible?.premise || 'Chưa có thông tin bối cảnh.')}&quot;</p>
                  <div className="text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                    <p><span className="font-medium text-zinc-900 dark:text-zinc-100">Tone:</span> {normalizeText(storyBible?.tone || 'N/A')}</p>
                    <p><span className="font-medium text-zinc-900 dark:text-zinc-100">Luật thế giới:</span> {worldRulesCount} quy tắc</p>
                  </div>
                </section>

                <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm overflow-hidden flex flex-col h-[250px]">
                  <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 shrink-0">Nhân vật ({characters.length})</h2>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                    {characters.map((char: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="font-medium">{normalizeText(char.name)}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{normalizeText(char.role)}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800`}>
                          còn sống
                        </span>
                      </div>
                    ))}
                    {characters.length === 0 && (
                      <p className="text-sm text-zinc-500 italic">Chưa có nhân vật</p>
                    )}
                  </div>
                </section>
              </div>

              {/* Mạch truyện và chương */}
              <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Mạch truyện & chương</h2>
                
                {arcs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {arcs.map((arc: any, i: number) => (
                      <div key={i} className="border-l-2 border-blue-500 pl-3">
                        <h3 className="font-medium text-sm mb-1">{normalizeText(arc.title)}</h3>
                        <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{arc.chapters_count || 0} chapters</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Chương đã sinh ({chapters.length})</h3>
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-sm text-left relative">
                    <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 uppercase border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ch.</th>
                        <th className="px-4 py-2 font-medium">Tiêu đề</th>
                        <th className="px-4 py-2 font-medium">Trạng thái</th>
                        <th className="px-4 py-2 font-medium text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapters.map((ch: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3 text-zinc-500 font-mono">{ch.chapter_number}</td>
                          <td className="px-4 py-3 font-medium">{normalizeText(ch.title)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              hoàn tất
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handlePendingAction('edit', ch.chapter_number)}
                              disabled={isSettingAction || !!currentNovel.metadata?.pending_action}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
                            >
                              🔄 Viết lại từ đây
                            </button>
                          </td>
                        </tr>
                      ))}
                      {chapters.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Chưa có chương nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Vấn đề logic */}
              <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Logic & lỗi (Mock)</h2>
                  <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-medium">{mockLogic.length} open</span>
                </div>
                <div className="space-y-3">
                  {mockLogic.map((issue, i) => (
                    <div key={i} className="flex items-start gap-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${issue.severity === 'major' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <div className="flex-1">
                         <p className="text-sm">{issue.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-500 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-4xl mb-4">📚</span>
              <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">Chưa chọn truyện</h2>
              <p className="mt-2 text-sm">Vui lòng chọn một truyện bên danh sách để xem chi tiết.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
