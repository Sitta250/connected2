"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  BookOpen,
  Users,
  ShoppingBag,
  CalendarDays,
  UserCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/home",        label: "Home",    icon: Home },
  { href: "/courses",     label: "Courses", icon: BookOpen },
  { href: "/clubs",       label: "Clubs",   icon: Users },
  { href: "/marketplace", label: "Market",  icon: ShoppingBag },
  { href: "/events",      label: "Events",  icon: CalendarDays },
  { href: "/profile",     label: "Profile", icon: UserCircle },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-[rgba(197,197,212,0.2)]">
      <div className="flex items-center justify-around px-1 pb-safe pt-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-0",
                active ? "text-[#23389c]" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")}
              />
              <span className={cn("text-[9px] font-medium", active ? "text-[#23389c]" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
