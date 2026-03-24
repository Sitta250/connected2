"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition, useState, useRef } from "react"
import { Search, X } from "lucide-react"

type Program = { id: string; name: string; slug: string; level: string; school: string | null }

interface Props {
  progAbbrevMap?: Record<string, Program>
}

export function CoursesSearch({ progAbbrevMap = {} }: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const params    = useSearchParams()
  const [, start] = useTransition()
  const query     = params.get("q") ?? ""
  const [hint, setHint] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(value: string) {
    const ql = value.trim().toLowerCase()

    // Check if query matches a program abbreviation → show hint
    const matchedProg = ql ? (progAbbrevMap[ql] ?? null) : null
    setHint(matchedProg ? `Showing all ${matchedProg.name} courses` : null)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value) {
        next.set("q", value)
      } else {
        next.delete("q")
      }
      // Typing clears program/school/mine filters (but keeps year)
      next.delete("mine")
      next.delete("program")
      next.delete("school")
      next.delete("all")
      start(() => router.replace(`${pathname}?${next.toString()}`))
    }, 250)
  }

  return (
    <div className="mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder='Search by name, code, or abbreviation (e.g. "os", "cs")...'
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
      {hint && (
        <p className="text-xs text-[#23389c] mt-1.5 ml-1 font-medium">{hint}</p>
      )}
    </div>
  )
}
