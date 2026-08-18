import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ReaderOnly from './ReaderOnly'

export default async function ReadPage(props: {
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
    .select('id, title')
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
  
  return (
    <ReaderOnly 
      novelId={firstNovel.id}
      novelTitle={firstNovel.title}
      chapters={chapters || []} 
    />
  )
}
