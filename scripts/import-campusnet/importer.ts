/**
 * Constructor University – CampusNet Course Catalogue Importer
 *
 * Crawls the public CampusNet catalogue (no login required), extracts all
 * course modules and their semester-specific offerings from Spring 2023 onward,
 * and upserts them into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-campusnet/importer.ts
 *
 * Env (reads from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  or  NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
 */

import * as cheerio from "cheerio"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"

// ── Env ────────────────────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, "../../.env.local")
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
else dotenv.config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_KEY")
  process.exit(1)
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BASE_URL  = "https://campusnet.constructor.university"
const NAV_URL   = `${BASE_URL}/scripts/mgrqispi.dll?APPNAME=CampusNet&PRGNAME=EXTERNALPAGES&ARGUMENTS=-N000000000000001,-N000344,-Awelcome`
const MIN_YEAR  = 2023          // Spring 2023 and later
const RATE_MS   = 600           // ms between requests
const MAX_RETRY = 3             // retries on transient failure
const TIMEOUT   = 15_000        // fetch timeout (ms)

// ── Types ──────────────────────────────────────────────────────────────────────

interface SemesterLink {
  label: string   // "Spring 2023"
  url:   string
  year:  number
  season: string
}

interface CrawlContext {
  school:         string | null   // "School of Science", "School of CS & Engineering", etc.
  curriculumType: string | null   // "Undergraduate", "Graduate", "Pre-Degree", "Exchange/Visiting"
}

interface QueueItem {
  url:     string
  context: CrawlContext
}

interface CoursePage {
  url:     string
  context: CrawlContext
}

interface ParsedOffering {
  moduleNumber:   string | null
  moduleName:     string
  moduleUrl:      string
  school:         string | null
  curriculumType: string | null
  offeringNumber: string | null
  offeringName:   string
  offeringUrl:    string
  courseType:     string | null
  instructors:    string[]
  semester:       string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Matches CampusNet course codes at the start of a title string.
 * Handles patterns like:
 *   JTBQ-028          PREFIX-NUM
 *   JTLA-1206         PREFIX-NUM (variable digit count)
 *   CA-MATH-800-S     PREFIX-DEPT-NUM-SUFFIX
 *   CA-IEM-801-A      PREFIX-DEPT-NUM-SUFFIX
 *   CA-IEM-802        PREFIX-DEPT-NUM
 *   CA-999-16         PREFIX-NUM-NUM
 */
const COURSE_CODE_RE = /^([A-Z]{2,}(?:-[A-Z]+)*-\d+(?:-[A-Z0-9]+)?)\s+(.+)$/

/** "CA-MATH-800 General Cell Biology" → { moduleNumber: "CA-MATH-800", name: "General Cell Biology" } */
function parseModuleTitle(text: string): { moduleNumber: string | null; name: string } {
  const m = text.match(COURSE_CODE_RE)
  if (m) return { moduleNumber: m[1], name: m[2].trim() }
  return { moduleNumber: null, name: text.trim() }
}

/** "CA-MATH-800-S General Cell Biology" → { offeringNumber: "CA-MATH-800-S", name: "General Cell Biology" } */
function parseOfferingTitle(text: string): { offeringNumber: string | null; name: string } {
  const m = text.match(COURSE_CODE_RE)
  if (m) return { offeringNumber: m[1], name: m[2].trim() }
  return { offeringNumber: null, name: text.trim() }
}

/** Parse "Dr. John Smith; Prof. Jane Doe" → ["Dr. John Smith", "Prof. Jane Doe"] */
function parseInstructors(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => normalizeText(s))
    .filter((s) => s.length > 0 && s !== "Prof. Professor Test") // filter placeholder
}

async function fetchWithRetry(url: string, attempt = 1): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Connected-Importer/1.0 (university internal tool)" },
    })
    clearTimeout(timer)

    if (!res.ok) {
      // 404 is terminal; others are retryable
      if (res.status === 404) return null
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.text()

  } catch (err: any) {
    if (attempt >= MAX_RETRY) {
      console.warn(`   ⚠  Gave up after ${MAX_RETRY} attempts: ${url} — ${err.message}`)
      return null
    }
    const delay = 1000 * attempt
    console.warn(`   ↺  Retry ${attempt}/${MAX_RETRY} in ${delay}ms: ${url}`)
    await sleep(delay)
    return fetchWithRetry(url, attempt + 1)
  }
}

// ── Step 1 — Discover semester links ──────────────────────────────────────────

async function getSemesterLinks(): Promise<SemesterLink[]> {
  const html = await fetchWithRetry(NAV_URL)
  if (!html) throw new Error("Could not fetch nav page")

  const $ = cheerio.load(html)
  const links: SemesterLink[] = []

  // Semester links live in .nav .depth_2 li elements with title like "Spring 2026"
  $(".nav .depth_2.linkItem").each((_, el) => {
    const title = $(el).attr("title") ?? ""
    const href  = $(el).find("a").first().attr("href") ?? ""
    if (!href) return

    const m = title.match(/^(Spring|Fall|Summer|Winter)\s+(20\d{2})$/)
    if (!m) return

    const season = m[1]
    const year   = parseInt(m[2])
    if (year < MIN_YEAR) return

    links.push({
      label:  title,
      url:    href.startsWith("http") ? href : `${BASE_URL}${href}`,
      year,
      season,
    })
  })

  // Sort oldest first so logs read chronologically
  return links.sort((a, b) =>
    a.year !== b.year ? a.year - b.year :
    a.season === "Spring" ? -1 : 1
  )
}

// ── Step 2 — BFS crawl per semester (context-aware) ──────────────────────────

/** Extract school name from h2 breadcrumb, e.g. "School of Science" */
function extractSchool(html: string): string | null {
  const $ = cheerio.load(html)
  // Breadcrumb links in h2; last "School of …" link is the current school
  const links = $("h2 a").toArray().reverse()
  for (const el of links) {
    const text = normalizeText($(el).text().replace(/\s*>\s*$/, ""))
    // Strip discipline subtitle in parentheses
    const clean = text.replace(/\s*\(.*?\)\s*$/, "").trim()
    if (/^school of/i.test(clean)) return clean
  }
  return null
}

/** Extract curriculum type from h2 breadcrumb text */
function extractCurriculum(html: string): string | null {
  const $ = cheerio.load(html)
  const text = $("h2").text()
  if (/undergraduate/i.test(text))    return "Undergraduate"
  if (/graduate/i.test(text))         return "Graduate"
  if (/pre-degree/i.test(text))       return "Pre-Degree"
  if (/exchange|visiting/i.test(text)) return "Exchange/Visiting"
  return null
}

/**
 * BFS crawl from the semester root. Returns course-table pages with their
 * context (school, curriculum type) so the parser can store it on each course.
 */
async function crawlSemester(
  semesterUrl: string,
  visited: Set<string>
): Promise<CoursePage[]> {
  const coursePages: CoursePage[] = []
  const queue: QueueItem[] = [{ url: semesterUrl, context: { school: null, curriculumType: null } }]

  while (queue.length > 0) {
    const item = queue.shift()!
    if (visited.has(item.url)) continue
    visited.add(item.url)

    await sleep(RATE_MS)
    const html = await fetchWithRetry(item.url)
    if (!html) continue

    const $ = cheerio.load(html)

    // Enrich context from this page's breadcrumb
    const school         = extractSchool(html)         ?? item.context.school
    const curriculumType = extractCurriculum(html)     ?? item.context.curriculumType
    const ctx: CrawlContext = { school, curriculumType }

    // Course table page — record and stop recursing
    if ($(".eventTable").length > 0) {
      coursePages.push({ url: item.url, context: ctx })
      continue
    }

    // Navigation page — enqueue children with inherited context
    $("a.auditRegNodeLink").each((_, el) => {
      const href = $(el).attr("href") ?? ""
      if (!href) return
      const abs = href.startsWith("http") ? href : `${BASE_URL}${href}`
      if (!visited.has(abs)) queue.push({ url: abs, context: ctx })
    })
  }

  return coursePages
}

// ── Step 3 — Parse a course table page ────────────────────────────────────────

function parseCoursePage(html: string, pageUrl: string, semester: string, ctx: CrawlContext): ParsedOffering[] {
  const $         = cheerio.load(html)
  const offerings: ParsedOffering[] = []
  const skipped:  string[] = []

  // State: track the current module while iterating rows
  let currentModule: {
    moduleNumber: string | null
    moduleName:   string
    moduleUrl:    string
  } | null = null

  $(".eventTable tr").each((_, row) => {
    const $row = $(row)
    const cls  = ($row.attr("class") ?? "").trim()

    // ── Module header row ──────────────────────────────────────────────────
    if (cls === "tbsubhead") {
      const $link = $row.find("a.eventTitle").first()
      const href  = $link.attr("href") ?? ""

      // Only MODULEDETAILS links are module headers; COURSEDETAILS are handled below
      if (!href.includes("MODULEDETAILS") && !href.includes("PRGNAME=MODULE")) return

      const rawTitle = normalizeText($link.text())
      const { moduleNumber, name: moduleName } = parseModuleTitle(rawTitle)

      if (!moduleName) {
        skipped.push(`tbsubhead with no name at ${pageUrl}`)
        return
      }

      currentModule = {
        moduleNumber,
        moduleName,
        moduleUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      }
      return
    }

    // ── Course component row (.tbdata) ─────────────────────────────────────
    if (cls === "tbdata") {
      if (!currentModule) {
        // Offering without a module header — log and skip
        skipped.push(`tbdata without module context at ${pageUrl}`)
        return
      }

      const $link = $row.find("a.eventTitle").first()
      const href  = $link.attr("href") ?? ""
      const rawTitle = normalizeText($link.text())

      if (!rawTitle) return

      const { offeringNumber, name: offeringName } = parseOfferingTitle(rawTitle)

      // Instructors: text node immediately after the link
      const cellHtml = $row.find("td").eq(1).html() ?? ""
      const afterLink = normalizeText(
        cheerio.load(cellHtml)("body").text().replace(rawTitle, "")
      )
      const instructors = parseInstructors(afterLink)

      // Course type: last meaningful <td> (colspan=2 cell shows "Lecture" etc.)
      const courseTypeRaw = normalizeText(
        $row.find("td[colspan='2']").last().text() ||
        $row.find("td").last().text()
      )
      const courseType = courseTypeRaw && courseTypeRaw !== semester ? courseTypeRaw : null

      const offeringUrl = href.startsWith("http") ? href : href ? `${BASE_URL}${href}` : pageUrl

      offerings.push({
        moduleNumber:   currentModule.moduleNumber,
        moduleName:     currentModule.moduleName,
        moduleUrl:      currentModule.moduleUrl,
        school:         ctx.school,
        curriculumType: ctx.curriculumType,
        offeringNumber,
        offeringName,
        offeringUrl,
        courseType,
        instructors,
        semester,
      })
      return
    }

    // .level04 rows are section labels (CH-101-A heading above tbdata) — skip
  })

  if (skipped.length > 0) {
    skipped.forEach((s) => console.warn(`   ⚠  SKIPPED: ${s}`))
  }

  return offerings
}

// ── Step 4 — Upsert to Supabase ───────────────────────────────────────────────

async function upsertInstructor(
  db: SupabaseClient,
  name: string,
  cache: Map<string, string>
): Promise<string> {
  if (cache.has(name)) return cache.get(name)!

  const { data, error } = await db
    .from("instructors")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single()

  if (error || !data) throw new Error(`Instructor upsert failed for "${name}": ${error?.message}`)
  cache.set(name, data.id)
  return data.id
}

async function upsertCourse(
  db: SupabaseClient,
  offering: ParsedOffering,
  cache: Map<string, string>
): Promise<string> {
  const cacheKey = offering.moduleNumber ?? `name:${offering.moduleName}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  let id: string

  const courseBase = {
    name:            offering.moduleName,
    school:          offering.school,
    curriculum_type: offering.curriculumType,
    source_url:      offering.moduleUrl,
    last_synced_at:  new Date().toISOString(),
  }

  if (offering.moduleNumber) {
    // Numbered: partial unique index (WHERE module_number IS NOT NULL) can't be used
    // as an ON CONFLICT target by the JS client, so use select-then-insert/update.
    const { data: existing } = await db
      .from("campusnet_courses")
      .select("id")
      .eq("module_number", offering.moduleNumber)
      .maybeSingle()

    if (existing) {
      await db.from("campusnet_courses").update({ ...courseBase }).eq("id", existing.id)
      id = existing.id
    } else {
      const { data: inserted, error: insErr } = await db
        .from("campusnet_courses")
        .insert({ ...courseBase, module_number: offering.moduleNumber })
        .select("id")
        .single()

      if (insErr || !inserted)
        throw new Error(`Course upsert failed for "${offering.moduleNumber}": ${insErr?.message}`)
      id = inserted.id
    }
  } else {
    // Unnumbered: partial unique index on (name) WHERE module_number IS NULL
    // can't be used as an ON CONFLICT target, so use select-then-insert/update.
    const { data: existing } = await db
      .from("campusnet_courses")
      .select("id")
      .eq("name", offering.moduleName)
      .is("module_number", null)
      .maybeSingle()

    if (existing) {
      await db
        .from("campusnet_courses")
        .update({ ...courseBase })
        .eq("id", existing.id)
      id = existing.id
    } else {
      const { data: inserted, error: insErr } = await db
        .from("campusnet_courses")
        .insert({ ...courseBase, module_number: null })
        .select("id")
        .single()

      if (insErr || !inserted)
        throw new Error(`Course upsert failed for "${offering.moduleName}": ${insErr?.message}`)
      id = inserted.id
    }
  }

  cache.set(cacheKey, id)
  return id
}

async function upsertOffering(
  db: SupabaseClient,
  courseId: string,
  offering: ParsedOffering
): Promise<string> {
  const conflictKey = `${courseId}|${offering.semester}|${offering.offeringNumber ?? offering.offeringName}`

  const { data, error } = await db
    .from("course_offerings")
    .upsert(
      {
        course_id:       courseId,
        semester:        offering.semester,
        offering_number: offering.offeringNumber,
        name:            offering.offeringName,
        course_type:     offering.courseType,
        source_url:      offering.offeringUrl,
        last_synced_at:  new Date().toISOString(),
      },
      { onConflict: "course_id,semester,coalesce(offering_number, name)" }
    )
    .select("id")
    .single()

  // Supabase doesn't support expression-based onConflict in all versions —
  // fall back to select-then-insert if upsert fails
  if (error) {
    const { data: existing } = await db
      .from("course_offerings")
      .select("id")
      .eq("course_id", courseId)
      .eq("semester", offering.semester)
      .eq("offering_number", offering.offeringNumber ?? "")
      .maybeSingle()

    if (existing) {
      await db.from("course_offerings").update({
        name:           offering.offeringName,
        course_type:    offering.courseType,
        source_url:     offering.offeringUrl,
        last_synced_at: new Date().toISOString(),
      }).eq("id", existing.id)
      return existing.id
    }

    const { data: inserted, error: insErr } = await db
      .from("course_offerings")
      .insert({
        course_id:       courseId,
        semester:        offering.semester,
        offering_number: offering.offeringNumber,
        name:            offering.offeringName,
        course_type:     offering.courseType,
        source_url:      offering.offeringUrl,
        last_synced_at:  new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insErr || !inserted) {
      console.warn(`   ⚠  Offering skipped [${conflictKey}]: ${insErr?.message}`)
      return ""
    }
    return inserted.id
  }

  return data?.id ?? ""
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const reset = process.argv.includes("--reset")

  console.log("\n📚  Constructor University – CampusNet Importer")
  console.log(`   Min semester : Spring ${MIN_YEAR}+\n`)

  const db = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  if (reset) {
    console.log("🗑   --reset: clearing campusnet tables…")
    // Order matters: junction → offerings → courses (instructors kept as-is)
    await db.from("course_offering_instructors").delete().neq("course_offering_id", "00000000-0000-0000-0000-000000000000")
    await db.from("course_offerings").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("campusnet_courses").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    console.log("   ✓  Tables cleared\n")
  }

  // In-memory caches to avoid redundant DB round-trips per run
  const instructorCache = new Map<string, string>() // name → id
  const courseCache     = new Map<string, string>() // moduleNumber|name → id

  // ── 1. Get semester links ──────────────────────────────────────────────────
  console.log("🔍  Discovering semesters…")
  const semesters = await getSemesterLinks()
  console.log(`   Found ${semesters.length} semesters from ${MIN_YEAR}+:`)
  semesters.forEach((s) => console.log(`   • ${s.label}`))
  console.log()

  // ── 2. Process each semester ───────────────────────────────────────────────
  const visited = new Set<string>() // global across semesters to avoid re-crawling shared pages
  let totalOfferings = 0
  let totalSkipped   = 0

  for (const semester of semesters) {
    console.log(`\n📅  ${semester.label}`)
    console.log(`   Crawling…`)

    // BFS to find all pages with course tables (context-aware)
    const coursePages = await crawlSemester(semester.url, visited)
    console.log(`   Found ${coursePages.length} course-table page(s)`)

    let semesterOfferings = 0

    for (const { url: pageUrl, context } of coursePages) {
      await sleep(RATE_MS)
      const html = await fetchWithRetry(pageUrl)
      if (!html) { totalSkipped++; continue }

      const offerings = parseCoursePage(html, pageUrl, semester.label, context)

      for (const offering of offerings) {
        try {
          // a) Upsert course (module)
          const courseId = await upsertCourse(db, offering, courseCache)
          if (!courseId) { totalSkipped++; continue }

          // b) Upsert offering
          const offeringId = await upsertOffering(db, courseId, offering)
          if (!offeringId) { totalSkipped++; continue }

          // c) Upsert instructors + junction
          for (const name of offering.instructors) {
            try {
              const instructorId = await upsertInstructor(db, name, instructorCache)
              await db.from("course_offering_instructors").upsert(
                { course_offering_id: offeringId, instructor_id: instructorId },
                { onConflict: "course_offering_id,instructor_id" }
              )
            } catch (err: any) {
              console.warn(`   ⚠  Instructor skipped "${name}": ${err.message}`)
            }
          }

          semesterOfferings++
        } catch (err: any) {
          console.warn(`   ⚠  Row skipped: ${err.message}`)
          totalSkipped++
        }
      }
    }

    console.log(`   ✓  ${semesterOfferings} offerings upserted`)
    totalOfferings += semesterOfferings
  }

  // ── 3. Summary ────────────────────────────────────────────────────────────
  console.log(`\n✅  Done`)
  console.log(`   Offerings upserted : ${totalOfferings}`)
  console.log(`   Skipped            : ${totalSkipped}`)
  console.log(`   Unique courses     : ${courseCache.size}`)
  console.log(`   Unique instructors : ${instructorCache.size}\n`)
}

main().catch((err) => {
  console.error("\n❌  Fatal:", err)
  process.exit(1)
})
