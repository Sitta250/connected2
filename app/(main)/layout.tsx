import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop: left sidebar */}
      <Sidebar />

      {/* Page content */}
      <main className="flex-1 min-w-0">
        {/* Constrain width on desktop, full-width on mobile */}
        <div className="max-w-2xl mx-auto px-0 md:px-6 pb-24 md:pb-8 min-h-screen">
          {children}
        </div>
      </main>

      {/* Mobile: bottom nav */}
      <BottomNav />
    </div>
  )
}
