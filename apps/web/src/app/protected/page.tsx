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

  // Fetch some sample data from our workspace_items table
  const { data: items } = await supabase
    .from('workspace_items')
    .select('*')

  return (
    <div className="flex-1 w-full flex flex-col gap-20 items-center">
      <div className="w-full">
        <h2 className="font-bold text-4xl mb-4">Protected Area</h2>
        <p>Logged in as: {user.email}</p>
        
        <h3 className="font-bold text-2xl mt-8 mb-4">Your Workspace Items</h3>
        {items && items.length > 0 ? (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border p-4 my-2 rounded">
                <strong>{item.title}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No workspace items found.</p>
        )}
      </div>
    </div>
  )
}
