import { createClient } from "@/lib/supabase/server"
import { PageShell } from "@/components/layout/page-shell"
import { CoursesSearch } from "@/components/features/courses-search"
import { BookOpen, GraduationCap, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"

const LEVEL_STYLES = {
  bachelor: "bg-[#23389c]/10 text-[#23389c]",
  master:   "bg-emerald-50 text-emerald-700",
} as const

const SCHOOL_ICON: Record<string, React.ElementType> = {
  "School of Computer Science & Engineering": BookOpen,
  "School of Science":                        FlaskConical,
  "School of Business, Social & Decision Sciences": GraduationCap,
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("programs")
    .select("id, name, slug, level, school")
    .eq("is_active", true)
    .order("school", { ascending: true, nullsFirst: false })
    .order("name")

  if (q?.trim()) {
    query = query.ilike("name", `%${q.trim()}%`)
  }

  const { data: programs } = await query

  // Group by school
  const grouped = new Map<string, typeof programs>()
  for (const p of programs ?? []) {
    const key = p.school ?? "Other"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(p)
  }

  return (
    <PageShell title="Courses" subtitle="Browse Constructor University programmes">
      <CoursesSearch />
      {grouped.size === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">
          {q ? `No programmes match "${q}".` : "No programmes found."}
        </p>
      ) : (
        <div className="space-y-8 pb-8">
          {Array.from(grouped.entries()).map(([school, progs]) => {
            const Icon = SCHOOL_ICON[school] ?? BookOpen
            return (
              <section key={school}>
                {/* School header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-[#23389c]/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-[#23389c]" />
                  </div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    {school}
                  </h2>
                </div>

                {/* Program cards */}
                <div className="space-y-2">
                  {progs!.map((p) => (
                    <div
                      key={p.id}
                      className="bg-card rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
                    >
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {p.name}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                          LEVEL_STYLES[p.level as keyof typeof LEVEL_STYLES] ??
                            "bg-[#f3f3f3] text-muted-foreground"
                        )}
                      >
                        {p.level}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
