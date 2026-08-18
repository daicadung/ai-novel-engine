import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DetailDashboard from './DetailDashboard'

export default async function ReaderPage(props: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const params = await props.params
  const novelId = params.id

  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, status, target_chapter_count, created_at')
    .eq('id', novelId)
    .limit(1)

  const firstNovel = novels?.[0]

  if (!firstNovel) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Không tìm thấy truyện</h2>
        <p>Truyện chưa được lưu hoặc không tồn tại.</p>
      </div>
    )
  }

  const { data: chapters } = await supabase
    .from('chapters')
    .select('chapter_number, title, content, summary')
    .eq('novel_id', firstNovel.id)
    .order('chapter_number', { ascending: true })

  const { data: characters } = await supabase
    .from('characters')
    .select('name, role, description')

  // Let's parse world rules from worlds table
  const { data: worlds } = await supabase
    .from('worlds')
    .select('rules')
    .limit(1)
  
  let worldRules: any[] = []
  if (worlds && worlds[0] && worlds[0].rules) {
    const rulesObj = worlds[0].rules as Record<string, string>
    worldRules = Object.entries(rulesObj).map(([k, v]) => ({
      category: 'Quy Tắc Thế Giới',
      rule_name: k,
      description: v
    }))
  }
  
  const { data: bibles } = await supabase
    .from('story_bibles')
    .select('premise, genre, tone')
    .eq('novel_id', firstNovel.id)
    .limit(1)
  
  const storyBible = bibles?.[0] || null

  return (
    <DetailDashboard 
      novel={firstNovel} 
      chapters={chapters || []} 
      characters={characters || []} 
      worldRules={worldRules} 
      storyBible={storyBible}
      userEmail={user.email || 'Unknown'} 
    />
  )
}
