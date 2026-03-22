"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  BookOpen,
  Users,
  ShoppingBag,
  CalendarDays,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/home",        label: "Home",       icon: Home },
  { href: "/courses",     label: "Courses",    icon: BookOpen },
  { href: "/clubs",       label: "Clubs",      icon: Users },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/events",      label: "Events",     icon: CalendarDays },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r border-[rgba(197,197,212,0.2)] bg-background px-3 py-6">
      {/* Wordmark */}
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-[#23389c] tracking-tight">
            connected
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-[#23389c]/10 text-[#23389c]"
                  : "text-muted-foreground hover:bg-[#f3f3f3] hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-4.5 w-4.5 shrink-0", active ? "stroke-[2.5]" : "")}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Profile link at bottom */}
      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2",
          pathname.startsWith("/profile")
            ? "bg-[#23389c]/10 text-[#23389c]"
            : "text-muted-foreground hover:bg-[#f3f3f3] hover:text-foreground"
        )}
      >
        <div className="w-5 h-5 rounded-full bg-[#23389c]/20 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-[#23389c]">ME</span>
        </div>
        Profile
      </Link>
    </aside>
  )
}
