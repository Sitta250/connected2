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

interface ParsedOffering {
  moduleNumber:   string | null
  moduleName:     string
  moduleUrl:      string
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

/** "CH-101 General Cell Biology" → { moduleNumber: "CH-101", name: "General Cell Biology" } */
function parseModuleTitle(text: string): { moduleNumber: string | null; name: string } {
  const m = text.match(/^([A-Z]{1,6}-\d{3}[A-Z]?)\s+(.+)$/)
  if (m) return { moduleNumber: m[1], name: m[2].trim() }
  return { moduleNumber: null, name: text.trim() }
}

/** "CH-101-A General Cell Biology" → { offeringNumber: "CH-101-A", name: "General Cell Biology" } */
function parseOfferingTitle(text: string): { offeringNumber: string | null; name: string } {
  const m = text.match(/^([A-Z]{1,6}-\d{3}-[A-Z0-9]+)\s+(.+)$/)
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

// ── Step 2 — BFS crawl per semester ───────────────────────────────────────────

/**
 * Returns all URLs of pages that contain course tables (.eventTable)
 * reachable from the given semester root URL.
 */
async function crawlSemester(
  semesterUrl: string,
  semesterLabel: string,
  visited: Set<string>
): Promise<string[]> {
  const coursePages: string[] = []
  const queue = [semesterUrl]

  while (queue.length > 0) {
    const url = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)

    await sleep(RATE_MS)
    const html = await fetchWithRetry(url)
    if (!html) continue

    const $ = cheerio.load(html)

    // If this page has a course table, record it for parsing
    if ($(".eventTable").length > 0) {
      coursePages.push(url)
      continue // course-table pages don't have sub-nav
    }

    // Otherwise, enqueue all navigation links
    $("a.auditRegNodeLink").each((_, el) => {
      const href = $(el).attr("href") ?? ""
      if (!href) return
      const abs = href.startsWith("http") ? href : `${BASE_URL}${href}`
      if (!visited.has(abs)) queue.push(abs)
    })
  }

  return coursePages
}

// ── Step 3 — Parse a course table page ────────────────────────────────────────

function parseCoursePage(html: string, pageUrl: string, semester: string): ParsedOffering[] {
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

  if (offering.moduleNumber) {
    // Numbered: upsert on module_number
    const { data, error } = await db
      .from("campusnet_courses")
      .upsert(
        {
          module_number:  offering.moduleNumber,
          name:           offering.moduleName,
          source_url:     offering.moduleUrl,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "module_number" }
      )
      .select("id")
      .single()

    if (error || !data) throw new Error(`Course upsert failed for "${offering.moduleNumber}": ${error?.message}`)
    id = data.id
  } else {
    // Unnumbered: upsert on name (uses partial index)
    const { data, error } = await db
      .from("campusnet_courses")
      .upsert(
        {
          module_number:  null,
          name:           offering.moduleName,
          source_url:     offering.moduleUrl,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "name" }
      )
      .select("id")
      .single()

    if (error || !data) throw new Error(`Course upsert failed for "${offering.moduleName}": ${error?.message}`)
    id = data.id
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
  console.log("\n📚  Constructor University – CampusNet Importer")
  console.log(`   Min semester : Spring ${MIN_YEAR}+\n`)

  const db = createClient(SUPABASE_URL!, SUPABASE_KEY!)

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

    // BFS to find all pages with course tables
    const coursePages = await crawlSemester(semester.url, semester.label, visited)
    console.log(`   Found ${coursePages.length} course-table page(s)`)

    let semesterOfferings = 0

    for (const pageUrl of coursePages) {
      await sleep(RATE_MS)
      const html = await fetchWithRetry(pageUrl)
      if (!html) { totalSkipped++; continue }

      const offerings = parseCoursePage(html, pageUrl, semester.label)

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
