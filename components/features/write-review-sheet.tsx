"use client"

import { useState, useTransition } from "react"
import { X, Star, ChevronDown } from "lucide-react"
import { submitReview } from "@/app/actions/review"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type Workload  = "light" | "moderate" | "heavy" | "very_heavy"
type ExamType  = "paper" | "online" | "project" | "presentation" | "other"

const WORKLOADS: { value: Workload; label: string; sub: string }[] = [
  { value: "light",      label: "Light",      sub: "< 5 hrs/wk" },
  { value: "moderate",   label: "Moderate",   sub: "5–10 hrs/wk" },
  { value: "heavy",      label: "Heavy",      sub: "10–15 hrs/wk" },
  { value: "very_heavy", label: "Very Heavy", sub: "15+ hrs/wk" },
]

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: "paper",        label: "Paper Exam" },
  { value: "online",       label: "Online Exam" },
  { value: "project",      label: "Project" },
  { value: "presentation", label: "Presentation" },
  { value: "other",        label: "Other" },
]

const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F", "in_progress"]

// ── Interactive star picker ────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform active:scale-90"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              i <= (hover || value)
                ? "fill-[#23389c] text-[#23389c]"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  )
}

// ── Difficulty picker (1–5 buttons) ──────────────────────────────────────────

function DifficultyPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["", "Very Easy", "Easy", "Moderate", "Hard", "Very Hard"]
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-colors",
              value === i
                ? "bg-[#23389c] text-white"
                : "bg-[#f3f3f3] text-muted-foreground hover:bg-[#e8e8e8]"
            )}
          >
            {i}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs text-center text-muted-foreground">{labels[value]}</p>
      )}
    </div>
  )
}

// ── Pill picker helper ────────────────────────────────────────────────────────

function Pill<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null
  options: { value: T; label: string; sub?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
            value === o.value
              ? "bg-[#23389c] text-white border-[#23389c]"
              : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#e8e8e8]"
          )}
        >
          {o.label}
          {o.sub && <span className="ml-1 opacity-70">{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface InitialData {
  rating:          number
  difficulty:      number
  workload:        string
  exam_type:       string
  exam_type_other: string | null
  body:            string
  pros:            string | null
  cons:            string | null
  tips:            string | null
  grade:           string | null
  semester:        string | null
  would_recommend: boolean
}

interface Props {
  courseId:     string
  semesters:    string[]          // from course_offerings for semester picker
  initialData?: InitialData       // pre-populate when editing
  onClose:      () => void
  onSuccess:    () => void
}

export function WriteReviewSheet({ courseId, semesters, initialData, onClose, onSuccess }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)

  const isEditing = !!initialData

  // Form state — seeded from initialData when editing
  const [rating,        setRating]        = useState(initialData?.rating ?? 0)
  const [difficulty,    setDifficulty]    = useState(initialData?.difficulty ?? 0)
  const [workload,      setWorkload]       = useState<Workload | null>((initialData?.workload as Workload) ?? null)
  const [examType,      setExamType]      = useState<ExamType | null>((initialData?.exam_type as ExamType) ?? null)
  const [examOther,     setExamOther]     = useState(initialData?.exam_type_other ?? "")
  const [body,          setBody]          = useState(initialData?.body ?? "")
  const [pros,          setPros]          = useState(initialData?.pros ?? "")
  const [cons,          setCons]          = useState(initialData?.cons ?? "")
  const [tips,          setTips]          = useState(initialData?.tips ?? "")
  const [grade,         setGrade]         = useState<string | null>(initialData?.grade ?? null)
  const [semester,      setSemester]      = useState(initialData?.semester ?? semesters[0] ?? "")
  const [wouldRecommend, setWouldRecommend] = useState(initialData?.would_recommend ?? true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating)     return setError("Please select a star rating.")
    if (!difficulty) return setError("Please select a difficulty.")
    if (!workload)   return setError("Please select a workload.")
    if (!examType)   return setError("Please select an exam type.")
    if (!body.trim()) return setError("Please write a review.")
    if (examType === "other" && !examOther.trim()) return setError("Please describe the exam type.")

    setError(null)
    startTransition(async () => {
      const result = await submitReview({
        courseId,
        rating,
        difficulty,
        workload,
        examType,
        examTypeOther: examOther,
        body,
        pros,
        cons,
        tips,
        grade: grade ?? undefined,
        semester,
        wouldRecommend,
      })
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-t-3xl max-h-[92dvh] overflow-y-auto pb-28"
      >
        {/* Handle + header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-border/50 px-5 pt-4 pb-3 z-10">
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">{isEditing ? "Edit Your Review" : "Write a Review"}</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-[#f3f3f3]">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-5 space-y-6">

          {/* Star rating */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Overall Rating <span className="text-red-500">*</span>
            </label>
            <StarPicker value={rating} onChange={setRating} />
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Difficulty <span className="text-red-500">*</span>
            </label>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          </div>

          {/* Workload */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Workload <span className="text-red-500">*</span>
            </label>
            <Pill<Workload> value={workload} options={WORKLOADS} onChange={setWorkload} />
          </div>

          {/* Exam type */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Assessment Type <span className="text-red-500">*</span>
            </label>
            <Pill<ExamType> value={examType} options={EXAM_TYPES} onChange={setExamType} />
            {examType === "other" && (
              <input
                type="text"
                placeholder="Describe the assessment type…"
                value={examOther}
                onChange={(e) => setExamOther(e.target.value)}
                className="w-full bg-[#f3f3f3] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#23389c] mt-2"
              />
            )}
          </div>

          {/* Grade */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Grade Received
            </label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(grade === g ? null : g)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    grade === g
                      ? "bg-[#23389c] text-white border-[#23389c]"
                      : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#e8e8e8]"
                  )}
                >
                  {g === "in_progress" ? "In Progress" : g}
                </button>
              ))}
            </div>
          </div>

          {/* Semester */}
          {semesters.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Semester Taken
              </label>
              <div className="relative">
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full appearance-none bg-[#f3f3f3] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#23389c] pr-8"
                >
                  {semesters.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Review body */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Review <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Share your overall experience with this course…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full bg-[#f3f3f3] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c] resize-none"
            />
          </div>

          {/* Pros */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-green-600">
              Pros
            </label>
            <textarea
              placeholder="What did you like? (one per line)"
              value={pros}
              onChange={(e) => setPros(e.target.value)}
              rows={3}
              className="w-full bg-green-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none border border-green-100 placeholder:text-green-400"
            />
          </div>

          {/* Cons */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-red-500">
              Cons
            </label>
            <textarea
              placeholder="What could be better? (one per line)"
              value={cons}
              onChange={(e) => setCons(e.target.value)}
              rows={3}
              className="w-full bg-red-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none border border-red-100 placeholder:text-red-400"
            />
          </div>

          {/* Tips */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#23389c]">
              Tips for Success
            </label>
            <textarea
              placeholder="Advice for future students…"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              rows={3}
              className="w-full bg-[#23389c]/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c] resize-none border border-[#23389c]/10 placeholder:text-[#23389c]/40"
            />
          </div>

          {/* Would recommend */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium">Would you recommend this course?</span>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setWouldRecommend(v)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
                    wouldRecommend === v
                      ? "bg-[#23389c] text-white border-[#23389c]"
                      : "bg-[#f3f3f3] text-foreground border-transparent"
                  )}
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#23389c] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#23389c]/20 disabled:opacity-60 transition-opacity active:scale-[0.98]"
          >
            {pending ? "Saving…" : isEditing ? "Save Changes" : "Submit Review"}
          </button>
        </div>
      </form>
    </div>
  )
}
