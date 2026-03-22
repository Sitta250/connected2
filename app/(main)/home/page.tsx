import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, BookOpen, Users, ShoppingBag, CalendarDays } from "lucide-react"
import { getInitials } from "@/lib/utils"

const QUICK_LINKS = [
  { label: "Courses",     href: "/courses",     icon: BookOpen,     color: "bg-[#23389c]/10 text-[#23389c]" },
  { label: "Clubs",       href: "/clubs",       icon: Users,        color: "bg-[#3e51b5]/10 text-[#3e51b5]" },
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag,  color: "bg-[#6c3300]/10 text-[#6c3300]" },
  { label: "Events",      href: "/events",      icon: CalendarDays, color: "bg-emerald-50 text-emerald-700" },
] as const

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch just enough to personalise the greeting
  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single()

  const profile = profileData as { full_name: string; avatar_url: string | null } | null
  const firstName = profile?.full_name?.split(" ")[0] ?? "there"

  return (
    <div className="px-4 pt-12 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Good to see you,</p>
          <h1 className="font-display text-2xl font-bold text-foreground mt-0.5">
            {firstName} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Notifications"
            className="w-9 h-9 rounded-full bg-[#f3f3f3] flex items-center justify-center text-muted-foreground"
          >
            <Bell className="h-4 w-4" />
          </button>
          <Link href="/profile" aria-label="Profile">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-[#23389c] text-white text-sm font-semibold">
                {getInitials(profile?.full_name ?? "?")}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Hero card */}
      <div className="gradient-primary rounded-2xl p-5 text-white">
        <p className="text-sm font-medium text-white/70 mb-1">Welcome to</p>
        <h2 className="font-display text-xl font-bold">Connected</h2>
        <p className="text-sm text-white/80 mt-1 leading-relaxed">
          Your university hub — courses, clubs, marketplace and more, all in one place.
        </p>
      </div>

      {/* Quick links */}
      <section>
        <h2 className="font-display text-base font-semibold mb-3">Explore</h2>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ label, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="bg-card rounded-2xl p-4 flex items-center gap-3 hover:bg-[#f3f3f3] transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Activity feed placeholder */}
      <section>
        <h2 className="font-display text-base font-semibold mb-3">Recent activity</h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f3f3f3] shrink-0 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#f3f3f3] rounded-full w-3/4 animate-pulse" />
                <div className="h-2.5 bg-[#f3f3f3] rounded-full w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
          <p className="text-center text-xs text-muted-foreground pt-1">
            Activity feed coming soon
          </p>
        </div>
      </section>
    </div>
  )
}
