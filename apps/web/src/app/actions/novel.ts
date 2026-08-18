'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function deleteNovel(novelId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // The database should have ON DELETE CASCADE for foreign keys related to novel_id.
  const { error } = await supabase
    .from('novels')
    .delete()
    .eq('id', novelId)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/protected')
  redirect('/protected')
}
