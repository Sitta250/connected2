"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Search, X } from "lucide-react"

export function CoursesSearch() {
  const router      = useRouter()
  const pathname    = usePathname()
  const params      = useSearchParams()
  const [, start]   = useTransition()
  const query       = params.get("q") ?? ""

  function handleChange(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("q", value)
    else next.delete("q")
    start(() => router.replace(`${pathname}?${next.toString()}`))
  }

  return (
    <div className="relative mb-6">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder="Search programmes…"
        defaultValue={query}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full bg-[#f3f3f3] rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#23389c] transition-shadow"
      />
      {query && (
        <button
          onClick={() => handleChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
