import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function messageParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const message = messageParam(params.message)

  const login = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      redirect('/login?message=Could not authenticate user')
    }

    return redirect('/protected')
  }

  const signup = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      redirect(`/login?message=${encodeURIComponent(error.message)}`)
    }

    return redirect('/login?message=Account created. Check email if confirmation is enabled, then sign in.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-950">
      <form className="flex w-full max-w-md flex-col gap-3 border border-zinc-200 bg-white p-6" action={login}>
        <div>
          <p className="text-sm font-medium text-blue-700">AI Novel Engine</p>
          <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        </div>
        {message ? (
          <p className="border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>
        ) : null}
        <label className="text-md" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="password"
          required
        />
        <button className="bg-green-700 px-4 py-2 text-white">
          Sign In
        </button>
        <button className="border border-zinc-300 px-4 py-2 text-zinc-900" formAction={signup}>
          Create Account
        </button>
      </form>
    </main>
  )
}
