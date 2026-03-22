import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

async function signOutAction() {
  "use server"
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export function SignOutForm() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full py-3 text-sm font-medium text-destructive hover:bg-destructive/5 rounded-2xl transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}
