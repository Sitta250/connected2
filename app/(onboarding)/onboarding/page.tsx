"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, ArrowLeft, GraduationCap, Search, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeOnboarding } from "./actions"
import { createClient } from "@/lib/supabase/client"
import type { YearOfStudy } from "@/lib/types/database"

// ─── Constructor University faculties ──────────────────────────────────────────
const FACULTIES = [
  "Computer Science & Electrical Engineering",
  "Mathematics & Logistics",
  "Physics & Earth Sciences",
  "Biochemistry & Chemistry",
  "Life Sciences & Medicine",
  "Social Sciences & Humanities",
  "Business Administration & Economics",
]

const YEARS: { value: YearOfStudy; label: string }[] = [
  { value: "1",       label: "1st Year" },
  { value: "2",       label: "2nd Year" },
  { value: "3",       label: "3rd Year" },
  { value: "4",       label: "4th Year" },
  { value: "masters", label: "Masters"  },
  { value: "phd",     label: "PhD"      },
]

type ProgramRow = { name: string; level: string; school: string | null }
type Step = 1 | 2

/** Map year_of_study → expected program level */
function levelForYear(year: YearOfStudy | ""): "bachelor" | "master" | null {
  if (year === "1" || year === "2" || year === "3" || year === "4") return "bachelor"
  if (year === "masters") return "master"
  return null // phd or not selected → show all
}

export default function OnboardingPage() {
  const [step, setStep]     = useState<Step>(1)
  const [isPending, start]  = useTransition()
  const [error, setError]   = useState<string | null>(null)

  // Form state
  const [fullName, setFullName]       = useState("")
  const [faculty, setFaculty]         = useState("")
  const [major, setMajor]             = useState("")
  const [yearOfStudy, setYearOfStudy] = useState<YearOfStudy | "">("")

  // Programme dropdown state
  const [programs, setPrograms]         = useState<ProgramRow[]>([])
  const [programSearch, setProgramSearch] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef                     = useRef<HTMLDivElement>(null)

  // Fetch all programs once on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("programs")
      .select("name, level, school")
      .eq("is_active", true)
      .order("level")
      .order("name")
      .then(({ data }) => { if (data) setPrograms(data as ProgramRow[]) })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  // When year changes, clear major if its level no longer matches
  useEffect(() => {
    if (!major || !yearOfStudy) return
    const expectedLevel = levelForYear(yearOfStudy)
    if (!expectedLevel) return
    const selectedProgram = programs.find((p) => p.name === major)
    if (selectedProgram && selectedProgram.level !== expectedLevel) {
      setMajor("")
    }
  }, [yearOfStudy])

  // Filtered program list
  const expectedLevel = levelForYear(yearOfStudy)
  const filteredPrograms = programs.filter((p) => {
    if (expectedLevel && p.level !== expectedLevel) return false
    if (programSearch && !p.name.toLowerCase().includes(programSearch.toLowerCase())) return false
    return true
  })

  function selectProgram(name: string) {
    setMajor(name)
    setProgramSearch("")
    setDropdownOpen(false)
  }

  // ── Step 1 → 2 ────────────────────────────────────────────────────────────
  function goToStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    setStep(2)
  }

  // ── Final submit ───────────────────────────────────────────────────────────
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!faculty || !major || !yearOfStudy) return
    setError(null)
    start(async () => {
      const result = await completeOnboarding({
        full_name:     fullName,
        faculty,
        major,
        year_of_study: yearOfStudy as YearOfStudy,
      })
      if (result?.error) setError(result.error)
    })
  }

  // ── Progress dots ──────────────────────────────────────────────────────────
  const StepDots = () => (
    <div className="flex items-center gap-2 mb-8">
      {([1, 2] as Step[]).map((s) => (
        <div
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            s === step ? "w-8 bg-[#23389c]" : "w-4 bg-[#23389c]/20"
          )}
        />
      ))}
    </div>
  )

  return (
    <div>
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
          <GraduationCap className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="font-display text-lg font-bold text-[#23389c] tracking-tight">
          connected
        </span>
      </div>

      <StepDots />

      {/* ── Step 1: Name ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={goToStep2} className="space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Welcome! Tell us a bit about yourself.
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              This helps other Constructor students find and connect with you.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="e.g. Alex Müller"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              className="bg-[#f3f3f3] border-0 focus-visible:ring-[#23389c] h-11"
            />
            <p className="text-xs text-muted-foreground">
              Your name is visible to other students at Constructor University.
            </p>
          </div>

          <Button
            type="submit"
            disabled={!fullName.trim()}
            className="w-full gradient-primary text-white border-0 h-11 gap-2"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* ── Step 2: Academic ───────────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={submit} className="space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              What are you studying?
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              We'll use this to personalise your course and club recommendations.
            </p>
          </div>

          {/* ── Year of study (first — filters the programme list) ─────────── */}
          <div className="space-y-2">
            <Label>Year of Study</Label>
            <div className="grid grid-cols-3 gap-2">
              {YEARS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setYearOfStudy(value)}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-medium transition-colors",
                    yearOfStudy === value
                      ? "bg-[#23389c] text-white"
                      : "bg-[#f3f3f3] text-foreground hover:bg-[#eeeeee]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {yearOfStudy && (
              <p className="text-xs text-muted-foreground">
                {expectedLevel
                  ? `Showing ${expectedLevel} programmes`
                  : "Showing all programmes"}
              </p>
            )}
          </div>

          {/* ── Programme / Major (searchable dropdown) ────────────────────── */}
          <div className="space-y-1.5">
            <Label>Programme / Major</Label>
            <div className="relative" ref={dropdownRef}>
              {/* Trigger */}
              <button
                type="button"
                onClick={() => { setDropdownOpen((o) => !o); setProgramSearch("") }}
                className={cn(
                  "w-full flex items-center justify-between px-3 h-11 rounded-xl text-sm transition-colors bg-[#f3f3f3]",
                  dropdownOpen ? "ring-2 ring-[#23389c]" : "hover:bg-[#eeeeee]"
                )}
              >
                <span className={major ? "text-foreground" : "text-muted-foreground"}>
                  {major || (yearOfStudy ? "Select your programme…" : "Select year first, then choose programme…")}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", dropdownOpen && "rotate-180")} />
              </button>

              {/* Dropdown panel */}
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white rounded-2xl shadow-lg border border-[#eeeeee] overflow-hidden">
                  {/* Search input */}
                  <div className="p-2 border-b border-[#f3f3f3]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search programmes…"
                        value={programSearch}
                        onChange={(e) => setProgramSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-[#f3f3f3] rounded-lg outline-none focus:ring-2 focus:ring-[#23389c]"
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="max-h-56 overflow-y-auto py-1">
                    {filteredPrograms.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {yearOfStudy
                          ? "No programmes match your search."
                          : "Select your year of study to see relevant programmes."}
                      </p>
                    ) : (
                      filteredPrograms.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => selectProgram(p.name)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-[#f3f3f3] transition-colors gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{p.name}</p>
                            {p.school && (
                              <p className="text-xs text-muted-foreground truncate">{p.school}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                              p.level === "bachelor"
                                ? "bg-[#23389c]/10 text-[#23389c]"
                                : "bg-emerald-50 text-emerald-700"
                            )}>
                              {p.level}
                            </span>
                            {major === p.name && <Check className="h-3.5 w-3.5 text-[#23389c]" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Faculty ────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Faculty</Label>
            <div className="grid gap-2">
              {FACULTIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFaculty(f)}
                  className={cn(
                    "text-left px-4 py-3 rounded-xl text-sm transition-colors border",
                    faculty === f
                      ? "bg-[#23389c]/10 border-[#23389c] text-[#23389c] font-medium"
                      : "bg-[#f3f3f3] border-transparent text-foreground hover:bg-[#eeeeee]"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="gap-2 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="submit"
              disabled={isPending || !faculty || !major || !yearOfStudy}
              className="flex-1 gradient-primary text-white border-0 h-11"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Let's go →"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
