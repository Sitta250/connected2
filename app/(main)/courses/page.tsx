import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PageShell } from "@/components/layout/page-shell"
import { CoursesSearch } from "@/components/features/courses-search"
import { BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

const CURRICULUM_ORDER = ["Undergraduate", "Graduate", "Pre-Degree", "Exchange/Visiting"]
const YEAR_ORDINALS = ["", "1st", "2nd", "3rd", "4th"]

// ── Helpers ──────────────────────────────────────────────────────────────────

type Program  = { id: string; name: string; slug: string; level: string; school: string | null }
type CourseRow = { id: string; module_number: string | null; name: string; school: string | null; curriculum_type: string | null }

/** Generate abbreviation from program name: "Computer Science and Engineering" → "cse" */
function programAbbrev(name: string): string {
  const stop = new Set(["and", "of", "the", "for", "in", "at", "a", "an"])
  const words = name.toLowerCase().replace(/&/g, "and").split(/[\s,]+/).filter(Boolean)
  const sig   = words.filter((w) => !stop.has(w))
  return sig.length <= 1 ? (sig[0] ?? "").slice(0, 3) : sig.map((w) => w[0]).join("")
}

/** Generate abbreviation from a course name: "Operating Systems" → "os", "Introduction to Computer Science" → "ics" */
function courseAbbrev(name: string): string {
  // Only skip true filler words — keep meaningful words like "introduction", "advanced", "applied"
  const stop = new Set(["and", "of", "the", "for", "in", "at", "a", "an", "to", "with"])
  const words = name.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean)
  const sig   = words.filter((w) => w.length > 0 && !stop.has(w))
  return sig.map((w) => w[0]).join("")
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?:       string
    school?:  string
    mine?:    string
    all?:     string
    program?: string
    year?:    string
  }>
}) {
  const { q, school, mine, all, program: programSlug, year: yearParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch profile + all programs in parallel
  const [{ data: profile }, { data: programsRaw }] = await Promise.all([
    supabase.from("profiles").select("faculty, major").eq("id", user.id).single(),
    supabase.from("programs").select("id, name, slug, level, school").eq("is_active", true).order("level").order("name"),
  ])

  const programs = (programsRaw ?? []) as Program[]

  // Build abbreviation maps for programs
  const progAbbrevMap = new Map<string, Program>()
  for (const p of programs) {
    progAbbrevMap.set(programAbbrev(p.name), p)
    progAbbrevMap.set(p.slug, p)
    progAbbrevMap.set(p.name.toLowerCase(), p)
  }

  // User's own school from their major
  const userProgram = programs.find((p) => p.name === profile?.major)
  const userSchool  = userProgram?.school ?? null

  // Active year filter (1–4)
  const activeYear = yearParam ? parseInt(yearParam) : null

  // Normalise query
  const ql = q?.trim().toLowerCase() ?? ""

  // Check if the query exactly matches a program (abbreviation / slug / full name)
  const queryProgram: Program | null = ql ? (progAbbrevMap.get(ql) ?? null) : null

  // Active program from URL chip
  const urlProgram: Program | null = programs.find((p) => p.slug === programSlug) ?? null
  const activeProgram: Program | null = urlProgram ?? queryProgram

  // "My Major" default when no other filter/search is active
  const isMineActive =
    mine === "1" ||
    (!mine && !school && !all && !programSlug && !ql && !!userSchool)

  // Effective school filter
  const effectiveSchool: string | null =
    isMineActive && userSchool
      ? userSchool
      : activeProgram?.school ?? school ?? null

  // Single-word queries (no spaces) are handled JS-side so we can match:
  //   • course name abbreviations: "os" → "Operating Systems"
  //   • dash-stripped codes:      "acs202" → "ACS-202"
  //   • normal substrings:        "bio" → "Biology", "ACS-201"
  // Multi-word queries ("data structures") go straight to Postgres ilike.
  const isJSSideQuery = ql.length > 0 && !ql.includes(" ") && !queryProgram

  // ── Build Supabase query ────────────────────────────────────────────────────

  let dbQuery = supabase
    .from("campusnet_courses")
    .select("id, module_number, name, school, curriculum_type")
    .order("module_number", { ascending: true, nullsFirst: false })
    .order("name")

  // Multi-word text search goes to Postgres; single-word is handled in JS below
  if (ql && !queryProgram && !isJSSideQuery) {
    dbQuery = dbQuery.or(`name.ilike.%${ql}%,module_number.ilike.%${ql}%`)
  }

  if (effectiveSchool) dbQuery = dbQuery.eq("school", effectiveSchool)

  // Year filter: match 3-digit module number in the correct century
  // e.g. year=2 → module_number matches `-2\d{2}(-|$)` (ACS-202, etc.)
  // 4-digit numbers like FY-C-1006 do NOT match because the regex requires end-of-string or dash after 3 digits
  if (activeYear && activeYear >= 1 && activeYear <= 4) {
    dbQuery = dbQuery.filter("module_number", "match", `-${activeYear}\\d{2}(-[A-Za-z0-9]+)?$`)
  }

  // Instructor name lookup — run in parallel with main course query
  const instrSearchPromise = ql && !queryProgram
    ? supabase.from("instructors").select("id").ilike("name", `%${ql}%`)
    : Promise.resolve({ data: null })

  const [{ data: rawCourses }, { data: instrRows }] = await Promise.all([
    dbQuery,
    instrSearchPromise,
  ])

  let courses = (rawCourses ?? []) as CourseRow[]

  // Walk join chain for instructor matches: instructors → offerings → courses
  if (instrRows && instrRows.length > 0) {
    const instrIds = instrRows.map((r) => r.id)

    const { data: junctionRows } = await supabase
      .from("course_offering_instructors")
      .select("course_offering_id")
      .in("instructor_id", instrIds)

    if (junctionRows && junctionRows.length > 0) {
      const offeringIds = junctionRows.map((r) => r.course_offering_id)

      const { data: offeringRows } = await supabase
        .from("course_offerings")
        .select("course_id")
        .in("id", offeringIds)

      if (offeringRows && offeringRows.length > 0) {
        const instrCourseIds = new Set(offeringRows.map((r) => r.course_id))
        const existingIds    = new Set(courses.map((c) => c.id))
        const missingIds     = [...instrCourseIds].filter((id) => !existingIds.has(id))

        if (missingIds.length > 0) {
          let extraQuery = supabase
            .from("campusnet_courses")
            .select("id, module_number, name, school, curriculum_type")
            .in("id", missingIds)
            .order("module_number", { ascending: true, nullsFirst: false })
            .order("name")

          if (activeYear && activeYear >= 1 && activeYear <= 4) {
            extraQuery = extraQuery.filter("module_number", "match", `-${activeYear}\\d{2}(-[A-Za-z0-9]+)?$`)
          }

          const { data: extraCourses } = await extraQuery
          courses = [...courses, ...((extraCourses ?? []) as CourseRow[])]
        }
      }
    }
  }

  // JS-side filtering for single-word queries (skip if query matched an instructor)
  const instrMatched = instrRows && instrRows.length > 0
  if (isJSSideQuery && !instrMatched) {
    courses = courses.filter((c) => {
      const nameL       = c.name.toLowerCase()
      const modL        = (c.module_number ?? "").toLowerCase()
      const modStripped = modL.replace(/-/g, "")          // "acs-202" → "acs202"
      const qStripped   = ql.replace(/-/g, "")            // normalise query too
      return (
        nameL.includes(ql)           ||   // name substring
        modL.includes(ql)            ||   // code substring (with dashes)
        modStripped.includes(qStripped) || // code without dashes: "acs202" → "ACS-202"
        courseAbbrev(c.name) === ql        // name initials: "os" → "Operating Systems"
      )
    })
  } else if (isJSSideQuery && instrMatched) {
    // Also keep courses that match by name/code (already in list from main query)
    // No additional filtering needed — union is already done above
  }

  // ── Group ─────────────────────────────────────────────────────────────────

  const byCurriculum = new Map<string, Map<string, CourseRow[]>>()
  for (const c of courses) {
    const curriculum = c.curriculum_type ?? "Other"
    const schoolKey  = c.school ?? "Other"
    if (!byCurriculum.has(curriculum)) byCurriculum.set(curriculum, new Map())
    const bySchool = byCurriculum.get(curriculum)!
    if (!bySchool.has(schoolKey)) bySchool.set(schoolKey, [])
    bySchool.get(schoolKey)!.push(c)
  }

  const totalCount     = courses.length
  const bachelorProgs  = programs.filter((p) => p.level === "bachelor")
  const masterProgs    = programs.filter((p) => p.level === "master")

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell title="Courses" subtitle="Constructor University course catalogue">
      <CoursesSearch progAbbrevMap={Object.fromEntries(progAbbrevMap)} />

      {/* ── Quick filter row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3 -mt-2">
        {/* All */}
        <a
          href="/courses?all=1"
          className={cn(
            "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
            !isMineActive && !effectiveSchool && !activeYear
              ? "bg-[#23389c]/10 text-[#23389c] border-[#23389c]"
              : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#eeeeee]"
          )}
        >
          All
        </a>

        {/* My Major */}
        {userSchool && (
          <a
            href={isMineActive ? "/courses?all=1" : "/courses?mine=1"}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
              isMineActive
                ? "bg-[#23389c] text-white border-[#23389c]"
                : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#eeeeee]"
            )}
          >
            My Major
          </a>
        )}

        {/* Year chips */}
        {[1, 2, 3, 4].map((yr) => {
          const isActive = activeYear === yr
          // Preserve school/mine/program when toggling year
          const baseParams = new URLSearchParams()
          if (isMineActive) baseParams.set("mine", "1")
          else if (programSlug) baseParams.set("program", programSlug)
          else if (school) baseParams.set("school", school)
          else if (all) baseParams.set("all", "1")
          const href = isActive
            ? `/courses?${baseParams.toString()}`
            : `/courses?${baseParams.toString()}&year=${yr}`
          return (
            <a
              key={yr}
              href={href}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                isActive
                  ? "bg-[#23389c]/10 text-[#23389c] border-[#23389c]"
                  : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#eeeeee]"
              )}
            >
              {YEAR_ORDINALS[yr]} Year
            </a>
          )
        })}
      </div>

      {/* ── Program filter chips ──────────────────────────────────────────── */}
      {[
        { label: "Bachelor", list: bachelorProgs },
        { label: "Master",   list: masterProgs   },
      ].map(({ label, list }) =>
        list.length === 0 ? null : (
          <div key={label} className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 ml-0.5">
              {label}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {list.map((p) => {
                const isActive = activeProgram?.slug === p.slug && !isMineActive
                // Preserve year when switching programs
                const yearSuffix = activeYear ? `&year=${activeYear}` : ""
                const href = isActive
                  ? `/courses${activeYear ? `?year=${activeYear}` : ""}`
                  : `/courses?program=${p.slug}${yearSuffix}`
                return (
                  <a
                    key={p.slug}
                    href={href}
                    className={cn(
                      "shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-[#23389c]/10 text-[#23389c] border-[#23389c]"
                        : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#eeeeee]"
                    )}
                  >
                    {p.name}
                  </a>
                )
              })}
            </div>
          </div>
        )
      )}

      {/* ── Count / context line ─────────────────────────────────────────────── */}
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground mb-4 mt-2">
          {totalCount} course{totalCount !== 1 ? "s" : ""}
          {isMineActive ? " in your major" : ""}
          {activeProgram && !isMineActive ? ` for ${activeProgram.name}` : ""}
          {effectiveSchool && !activeProgram && !isMineActive
            ? ` in ${effectiveSchool.replace("School of ", "")}`
            : ""}
          {activeYear ? ` · ${YEAR_ORDINALS[activeYear]} year` : ""}
          {ql && !queryProgram && !instrMatched ? ` matching "${ql}"` : ""}
          {ql && instrMatched ? ` taught by or matching "${ql}"` : ""}
          {queryProgram ? ` — all ${queryProgram.name} courses` : ""}
        </p>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#23389c]/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-[#23389c]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No courses found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ql
                ? `No courses match "${ql}". Try a different search.`
                : activeYear
                ? `No ${YEAR_ORDINALS[activeYear]}-year courses found for this filter.`
                : "Run the CampusNet importer to populate the catalogue."}
            </p>
          </div>
        </div>
      )}

      {/* ── Course list grouped by curriculum → school ───────────────────────── */}
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
                        <Link
                          key={c.id}
                          href={`/courses/${c.id}`}
                          className="bg-card rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-[#23389c]/5 transition-colors"
                        >
                          {c.module_number && (
                            <span className="shrink-0 text-xs font-mono font-semibold text-[#23389c] bg-[#23389c]/10 px-2 py-0.5 rounded-lg min-w-[60px] text-center">
                              {c.module_number}
                            </span>
                          )}
                          <p className="text-sm font-medium text-foreground leading-snug flex-1">
                            {c.name}
                          </p>
                        </Link>
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
