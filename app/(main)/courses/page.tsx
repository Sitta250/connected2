import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageShell } from "@/components/layout/page-shell"
import { CoursesSearch } from "@/components/features/courses-search"
import { BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

const CURRICULUM_ORDER = ["Undergraduate", "Graduate", "Pre-Degree", "Exchange/Visiting"]

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; school?: string; mine?: string }>
}) {
  const { q, school, mine } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch user's profile to power the "My Major" filter
  const { data: profile } = await supabase
    .from("profiles")
    .select("faculty, major")
    .eq("id", user.id)
    .single()

  // Look up the school for the user's programme
  let userSchool: string | null = null
  if (profile?.major) {
    const { data: prog } = await supabase
      .from("programs")
      .select("school")
      .eq("name", profile.major)
      .maybeSingle()
    userSchool = prog?.school ?? null
  }

  // Build query
  let query = supabase
    .from("campusnet_courses")
    .select("id, module_number, name, school, curriculum_type")
    .order("module_number", { ascending: true, nullsFirst: false })
    .order("name")

  if (q?.trim())     query = query.or(`name.ilike.%${q.trim()}%,module_number.ilike.%${q.trim()}%`)
  if (mine === "1" && userSchool) query = query.eq("school", userSchool)
  else if (school)   query = query.eq("school", school)

  const { data: courses } = await query

  // Group by curriculum_type → school
  type CourseRow = { id: string; module_number: string | null; name: string; school: string | null; curriculum_type: string | null }
  const byCurriculum = new Map<string, Map<string, CourseRow[]>>()

  for (const c of (courses ?? []) as CourseRow[]) {
    const curriculum = c.curriculum_type ?? "Other"
    const schoolKey  = c.school ?? "Other"
    if (!byCurriculum.has(curriculum)) byCurriculum.set(curriculum, new Map())
    const bySchool = byCurriculum.get(curriculum)!
    if (!bySchool.has(schoolKey)) bySchool.set(schoolKey, [])
    bySchool.get(schoolKey)!.push(c)
  }

  // Collect distinct schools for filter chips
  const allSchools = Array.from(
    new Set((courses ?? []).map((c: any) => c.school).filter(Boolean))
  ).sort() as string[]

  const activeSchool = mine === "1" ? userSchool : school ?? null
  const totalCount   = courses?.length ?? 0

  return (
    <PageShell title="Courses" subtitle="Constructor University course catalogue">
      <CoursesSearch />

      {/* ── Filter chips ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6 -mt-2">
        {/* My Major chip */}
        {userSchool && (
          <a
            href={mine === "1" ? "/courses" : "/courses?mine=1"}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
              mine === "1"
                ? "bg-[#23389c] text-white border-[#23389c]"
                : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#eeeeee]"
            )}
          >
            My Major
          </a>
        )}

        {/* School filter chips */}
        {allSchools.map((s) => {
          const label = s.replace("School of ", "").replace(" & ", " & ")
          const isActive = activeSchool === s && mine !== "1"
          const href = isActive ? "/courses" : `/courses?school=${encodeURIComponent(s)}`
          return (
            <a
              key={s}
              href={href}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                isActive
                  ? "bg-[#23389c]/10 text-[#23389c] border-[#23389c]"
                  : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#eeeeee]"
              )}
            >
              {label}
            </a>
          )
        })}
      </div>

      {/* ── Count ────────────────────────────────────────────────────────────── */}
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          {totalCount} course{totalCount !== 1 ? "s" : ""}
          {activeSchool ? ` in ${activeSchool.replace("School of ", "")}` : ""}
          {q ? ` matching "${q}"` : ""}
        </p>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#23389c]/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-[#23389c]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No courses found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {q
                ? `No courses match "${q}". Try a different search.`
                : "Run the CampusNet importer to populate the catalogue."}
            </p>
          </div>
        </div>
      )}

      {/* ── Course list grouped by curriculum → school ────────────────────────── */}
      <div className="space-y-8 pb-8">
        {CURRICULUM_ORDER.concat(
          Array.from(byCurriculum.keys()).filter((k) => !CURRICULUM_ORDER.includes(k))
        )
          .filter((curr) => byCurriculum.has(curr))
          .map((curriculum) => {
            const bySchool = byCurriculum.get(curriculum)!
            return (
              <section key={curriculum}>
                <h2 className="font-display text-base font-semibold text-foreground mb-3">
                  {curriculum}
                </h2>

                {Array.from(bySchool.entries()).map(([schoolName, rows]) => (
                  <div key={schoolName} className="mb-5">
                    {schoolName !== "Other" && (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 ml-1">
                        {schoolName.replace("School of ", "")}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {rows.map((c) => (
                        <div
                          key={c.id}
                          className="bg-card rounded-2xl px-4 py-3 flex items-center gap-3"
                        >
                          {c.module_number && (
                            <span className="shrink-0 text-xs font-mono font-semibold text-[#23389c] bg-[#23389c]/10 px-2 py-0.5 rounded-lg min-w-[60px] text-center">
                              {c.module_number}
                            </span>
                          )}
                          <p className="text-sm font-medium text-foreground leading-snug flex-1">
                            {c.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )
          })}
      </div>
    </PageShell>
  )
}
