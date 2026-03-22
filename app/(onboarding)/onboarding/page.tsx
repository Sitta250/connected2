"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, ArrowLeft, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeOnboarding } from "./actions"
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
  { value: "masters", label: "Masters" },
  { value: "phd",     label: "PhD" },
]

type Step = 1 | 2

export default function OnboardingPage() {
  const [step, setStep]       = useState<Step>(1)
  const [isPending, start]    = useTransition()
  const [error, setError]     = useState<string | null>(null)

  // Form state
  const [fullName, setFullName]         = useState("")
  const [faculty, setFaculty]           = useState("")
  const [major, setMajor]               = useState("")
  const [yearOfStudy, setYearOfStudy]   = useState<YearOfStudy | "">("")

  // ── Step 1 → 2 transition ──────────────────────────────────────────────────
  function goToStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    setStep(2)
  }

  // ── Final submit ───────────────────────────────────────────────────────────
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!faculty || !major.trim() || !yearOfStudy) return
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

  // ── Progress indicator ─────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
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

      {/* ── Step 1: Personal ───────────────────────────────────────────────── */}
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

          {/* Faculty */}
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

          {/* Major / programme */}
          <div className="space-y-1.5">
            <Label htmlFor="major">Programme / Major</Label>
            <Input
              id="major"
              type="text"
              placeholder="e.g. Computer Science, Biochemistry…"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              required
              className="bg-[#f3f3f3] border-0 focus-visible:ring-[#23389c] h-11"
            />
          </div>

          {/* Year of study */}
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
              disabled={isPending || !faculty || !major.trim() || !yearOfStudy}
              className="flex-1 gradient-primary text-white border-0 h-11"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Let's go →"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
