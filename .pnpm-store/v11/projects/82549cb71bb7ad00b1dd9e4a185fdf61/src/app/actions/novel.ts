'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteNovel(novelId: string) {
  const supabase = await createClient()

  // Xoá từ bảng novels là đủ nếu database có cấu hình ON DELETE CASCADE
  // Hoặc ta xoá thủ công các bảng con nếu không có cascade
  // Hiện tại MVP pipeline có nhiều bảng liên kết, tốt nhất là xoá từ novels
  const { error } = await supabase.from('novels').delete().eq('id', novelId)
  
  if (error) {
    console.error('Error deleting novel:', error)
    throw new Error('Failed to delete novel')
  }

  // Reload lại trang chủ
  revalidatePath('/')
}

export async function setPendingAction(novelId: string, action: 'continue' | 'edit', targetChapter?: number) {
  const supabase = await createClient()
  
  const { data: novel, error: fetchError } = await supabase
    .from('novels')
    .select('metadata')
    .eq('id', novelId)
    .single()
    
  if (fetchError || !novel) {
    console.error('Error fetching novel:', fetchError)
    throw new Error('Novel not found')
  }
  
  const metadata = typeof novel.metadata === 'object' && novel.metadata !== null 
    ? novel.metadata as any 
    : {}
    
  metadata.pending_action = action
  if (action === 'edit' && targetChapter) {
    metadata.target_chapter = targetChapter
  } else {
    delete metadata.target_chapter
  }
  
  const { error: updateError } = await supabase
    .from('novels')
    .update({ metadata })
    .eq('id', novelId)
    
  if (updateError) {
    console.error('Error updating novel pending_action:', updateError)
    throw new Error('Failed to set pending action')
  }
  
  revalidatePath('/')
}

export async function createNewNovel(title: string, chapters: number, language: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  const novelId = crypto.randomUUID()
  
  const { error } = await supabase.from('novels').insert({
    id: novelId,
    owner_id: user.id,
    title: title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    status: 'draft',
    language: language,
    target_chapter_count: chapters,
    metadata: {
      pipeline: 'mvp-pipeline',
      pending_action: 'new'
    }
  })
  
  if (error) {
    console.error('Error creating novel:', error)
    throw new Error('Failed to create novel: ' + error.message)
  }
  
  revalidatePath('/')
  return novelId
}
