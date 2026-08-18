import React from 'react'
import { createClient } from '@/utils/supabase/server'
import MainDashboardClient from './MainDashboardClient'

export default async function Dashboard(props: { searchParams: Promise<{ novel?: string }> }) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 text-center text-zinc-900 dark:text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Máy tạo truyện AI</h1>
        <p className="mb-4">Vui lòng đăng nhập để sử dụng AI Novel Engine.</p>
        <a href="/login" className="text-blue-600 hover:underline">Đăng nhập</a>
      </div>
    )
  }

  // Fetch novels list
  const { data: novelsRaw } = await supabase
    .from('novels')
    .select('id, title, status, target_chapter_count, created_at, story_bibles(genre)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const novels = (novelsRaw || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    status: n.status,
    target_chapter_count: n.target_chapter_count,
    created_at: n.created_at,
    genre: n.story_bibles && n.story_bibles.length > 0 ? n.story_bibles[0].genre : 'Chưa phân loại'
  }))

  // Determine current novel
  const selectedNovelId = searchParams.novel
  const currentNovel = selectedNovelId 
    ? novels.find(n => n.id === selectedNovelId) 
    : (novels.length > 0 ? novels[0] : null)

  let chapters: any[] = []
  let characters: any[] = []
  let arcs: any[] = []
  let storyBible: any = null
  let worldRulesCount = 0

  if (currentNovel) {
    // Fetch chapters
    const { data: chs } = await supabase
      .from('chapters')
      .select('chapter_number, title, status')
      .eq('novel_id', currentNovel.id)
      .order('chapter_number', { ascending: false })
      .limit(10)
    if (chs) chapters = chs

    // Fetch characters
    const { data: chars } = await supabase
      .from('characters')
      .select('name, role')
      .limit(20) // using limit because of mvp constraint where characters are global across novel currently
    if (chars) characters = chars

    // Fetch story bible
    const { data: bibles } = await supabase
      .from('story_bibles')
      .select('premise, genre, tone')
      .eq('novel_id', currentNovel.id)
      .limit(1)
    if (bibles && bibles.length > 0) storyBible = bibles[0]

    // Fetch arcs
    const { data: arcData } = await supabase
      .from('arcs')
      .select('title')
      .limit(5)
    if (arcData) arcs = arcData

    // Fetch world rules count
    const { data: worlds } = await supabase
      .from('worlds')
      .select('rules')
      .limit(1)
    if (worlds && worlds[0] && worlds[0].rules) {
      worldRulesCount = Object.keys(worlds[0].rules as Record<string, string>).length
    }
  }

  return (
    <MainDashboardClient 
      novels={novels}
      currentNovel={currentNovel}
      chapters={chapters}
      characters={characters}
      arcs={arcs}
      storyBible={storyBible}
      worldRulesCount={worldRulesCount}
    />
  )
}
