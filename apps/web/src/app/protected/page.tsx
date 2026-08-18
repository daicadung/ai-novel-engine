import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const { data: novelsRaw, error } = await supabase
    .from('novels')
    .select('id, title, status, target_chapter_count, created_at, story_bibles(genre)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching novels:', error)
  }

  // Format novels data
  const novels = (novelsRaw || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    status: n.status,
    target_chapter_count: n.target_chapter_count,
    created_at: n.created_at,
    // Extract genre from story_bibles array (could be multiple if many versions exist, take first)
    genre: n.story_bibles && n.story_bibles.length > 0 ? n.story_bibles[0].genre : 'Chưa phân loại'
  }))

  return (
    <DashboardClient 
      novels={novels} 
      userEmail={user.email || 'Unknown'} 
    />
  )
}
