/**
 * Constructor University – Study Program Importer
 *
 * Fetches the official Study Program Handbooks page, extracts all unique
 * bachelor and master programs from 2023 onward, and upserts them into
 * the `programs` Supabase table.
 *
 * Usage:
 *   npx tsx scripts/import-programs/importer.ts
 *
 * Env (reads from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← preferred (write access)
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  ← fallback
 */

import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import { createClient } from "@supabase/supabase-js"
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
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SOURCE_URL =
  "https://constructor.university/student-life/registrar-services/study-program-handbooks"
const MIN_YEAR = 2023

// ── Types ──────────────────────────────────────────────────────────────────────

type Level = "bachelor" | "master"

interface Program {
  name:       string
  slug:       string
  level:      Level
  school:     string | null
  source_url: string
  is_active:  boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00a0/g, " ")
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function extractYear(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/)
  return m ? parseInt(m[1], 10) : null
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parsePrograms(html: string): { programs: Program[]; ambiguous: string[] } {
  const $ = cheerio.load(html)
  const programs: Program[]  = []
  const ambiguous: string[]  = []
  const seen      = new Set<string>() // "name|level"
  const slugSeen  = new Set<string>()

  // State
  let currentLevel:  Level | null  = null
  let currentYear:   number | null = null
  let currentSchool: string | null = null
  let inMinors = false

  // Collect all relevant elements in document order:
  //   h3            → section boundary (bachelor / master)
  //   h4            → year heading OR school heading
  //   li.ck-list-marker-bold → program entry
  const nodes: Element[] = []
  $("h3, h4, li.ck-list-marker-bold").each((_, el) => {
    nodes.push(el as Element)
  })

  for (const node of nodes) {
    const $el = $(node)
    const tag = (node as any).tagName?.toLowerCase() ?? ""

    // ── h3: section boundary ──────────────────────────────────────────────────
    if (tag === "h3") {
      const id  = ($el.attr("id") ?? "").toLowerCase()
      const txt = $el.text().toLowerCase()

      if (id === "bachelor" || (txt.includes("bachelor") && txt.includes("program"))) {
        currentLevel  = "bachelor"
        currentYear   = null
        currentSchool = null
        inMinors      = false
      } else if (id === "master" || (txt.includes("master") && txt.includes("program"))) {
        currentLevel  = "master"
        currentYear   = null
        currentSchool = null
        inMinors      = false
      }
      continue
    }

    // ── h4: year heading or school heading ────────────────────────────────────
    if (tag === "h4") {
      const rawText  = $el.text().trim()
      const year     = extractYear(rawText)

      // Year heading  e.g. "Bachelor Study Program Handbooks 2025"
      if (year && /(handbook|program)/i.test(rawText)) {
        currentYear   = year
        currentSchool = null
        inMinors      = false
        continue
      }

      // School / special heading (text may be inside <strong>)
      const headingText = normalizeName(
        $el.find("strong").first().text().trim() || rawText
      )

      if (/minor/i.test(headingText)) {
        inMinors = true; currentSchool = null; continue
      }
      if (/special program/i.test(headingText)) {
        inMinors = false; currentSchool = null; continue
      }
      if (/^school of/i.test(headingText)) {
        inMinors = false; currentSchool = headingText; continue
      }

      // Log unknown h4 inside an active, in-range section
      if (currentLevel && currentYear && currentYear >= MIN_YEAR && headingText) {
        ambiguous.push(`UNKNOWN  [h4] "${headingText}" (${currentLevel}, ${currentYear})`)
      }
      continue
    }

    // ── li.ck-list-marker-bold: program entry ─────────────────────────────────
    if (!currentLevel || !currentYear || currentYear < MIN_YEAR || inMinors) continue

    // Name lives in the direct <strong> child (not nested ones inside document articles)
    const rawName = $el.children("strong").first().text().trim()
    if (!rawName) continue

    const name = normalizeName(rawName)

    // Skip document-link labels that appear inside program items
    if (/^(handbook|study scheme|requirements|pdf)/i.test(name)) continue

    // Skip minors
    if (/^minor\b/i.test(name)) {
      ambiguous.push(`SKIPPED  [minor] "${name}"`)
      continue
    }

    const key = `${name.toLowerCase()}|${currentLevel}`
    if (seen.has(key)) continue
    seen.add(key)

    // Handle slug collisions (different levels, same name — unlikely but safe)
    let slug = toSlug(name)
    if (slugSeen.has(slug)) {
      ambiguous.push(`WARN  [slug collision] "${name}" → appending level`)
      slug = `${slug}-${currentLevel}`
    }
    slugSeen.add(slug)

    programs.push({
      name,
      slug,
      level:      currentLevel,
      school:     currentSchool,
      source_url: SOURCE_URL,
      is_active:  true,
    })
  }

  return { programs, ambiguous }
}

// ── Supabase upsert ────────────────────────────────────────────────────────────

async function upsertPrograms(programs: Program[]): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  const CHUNK = 50

  for (let i = 0; i < programs.length; i += CHUNK) {
    const chunk = programs.slice(i, i + CHUNK)
    const { error } = await supabase
      .from("programs")
      .upsert(chunk, { onConflict: "name,level", ignoreDuplicates: false })

    if (error) {
      console.error(`❌  Supabase error (rows ${i}–${i + chunk.length}):`, error.message)
      throw error
    }
    console.log(`   ✓  Upserted rows ${i + 1}–${Math.min(i + CHUNK, programs.length)}`)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎓  Constructor University – Program Importer`)
  console.log(`   Source   : ${SOURCE_URL}`)
  console.log(`   Min year : ${MIN_YEAR}\n`)

  console.log("⏳  Fetching page…")
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const html = await res.text()
  console.log(`   ✓  ${html.length.toLocaleString()} bytes received\n`)

  console.log("🔍  Parsing programs…")
  const { programs, ambiguous } = parsePrograms(html)

  const bachelors = programs.filter((p) => p.level === "bachelor")
  const masters   = programs.filter((p) => p.level === "master")
  console.log(`   Bachelor : ${bachelors.length}`)
  console.log(`   Master   : ${masters.length}`)
  console.log(`   Total    : ${programs.length} unique programs\n`)

  if (ambiguous.length) {
    console.log("⚠️   Ambiguous / skipped:")
    ambiguous.forEach((m) => console.log(`   ${m}`))
    console.log()
  }

  if (programs.length === 0) {
    console.error("❌  No programs found — check selector logic.")
    process.exit(1)
  }

  console.log("📋  Programs:")
  programs.forEach((p) => {
    const school = p.school ? `  [${p.school}]` : ""
    console.log(`   [${p.level.padEnd(8)}] ${p.name}${school}`)
  })
  console.log()

  console.log("⬆️   Upserting to Supabase…")
  await upsertPrograms(programs)
  console.log(`\n✅  Done — ${programs.length} programs upserted.\n`)
}

main().catch((err) => {
  console.error("\n❌  Fatal:", err)
  process.exit(1)
})
