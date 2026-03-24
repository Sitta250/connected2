"use client"

import { useState, useTransition } from "react"
import { FileText, Star, MessageCircle, BookOpen, ExternalLink, ThumbsUp, Lightbulb, Trash2 } from "lucide-react"
import { WriteReviewSheet } from "./write-review-sheet"
import { deleteReview } from "@/app/actions/review"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Offering {
  id:              string
  semester:        string
  offering_number: string | null
  name:            string
  course_type:     string | null
}

export interface Resource {
  id:          string
  title:       string
  description: string | null
  file_url:    string | null
  type:        string
}

export interface Review {
  id:              string
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
  created_at:      string
  user_id:         string
}

export interface Question {
  id:           string
  title:        string
  body:         string | null
  is_resolved:  boolean | null
  created_at:   string
  answer_count: number
}

interface Props {
  campusnetCourseId: string
  campusnetCourse: {
    school:          string | null
    curriculum_type: string | null
  }
  offerings:  Offering[]
  resources:  Resource[]
  reviews:    Review[]
  questions:  Question[]
  currentUserId: string
  semesters:  string[]   // distinct semester list for the review form
}

const TABS = ["Overview", "Resources", "Reviews", "Q&A"] as const
type Tab = typeof TABS[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupBySemester(offerings: Offering[]): Map<string, Offering[]> {
  const map = new Map<string, Offering[]>()
  for (const o of offerings) {
    if (!map.has(o.semester)) map.set(o.semester, [])
    map.get(o.semester)!.push(o)
  }
  return map
}

function workloadLabel(w: string) {
  const map: Record<string, string> = {
    light: "Light (< 5 hrs/wk)",
    moderate: "Moderate (5–10 hrs/wk)",
    heavy: "Heavy (10–15 hrs/wk)",
    very_heavy: "Very Heavy (15+ hrs/wk)",
  }
  return map[w] ?? w
}

function examTypeLabel(t: string, other: string | null) {
  const map: Record<string, string> = {
    paper: "Paper Exam",
    online: "Online Exam",
    project: "Project",
    presentation: "Presentation",
    other: other ?? "Other",
  }
  return map[t] ?? t
}

function userInitials(userId: string) {
  // deterministic 2-letter initials from UUID
  return userId.slice(0, 2).toUpperCase()
}

function avatarColor(userId: string) {
  const colors = [
    "bg-[#23389c]/10 text-[#23389c]",
    "bg-green-100 text-green-700",
    "bg-orange-100 text-orange-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
  ]
  return colors[userId.charCodeAt(0) % colors.length]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRow({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i <= value ? "fill-[#23389c] text-[#23389c]" : "text-muted-foreground/20")}
        />
      ))}
    </span>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#23389c]/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-[#23389c]" />
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">{text}</p>
    </div>
  )
}

function ReviewSummary({
  reviews,
  hasOwnReview,
  onWrite,
}: {
  reviews: Review[]
  hasOwnReview: boolean
  onWrite: () => void
}) {
  const count        = reviews.length
  const avgRating    = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : null
  const avgDiff      = count > 0 ? reviews.reduce((s, r) => s + r.difficulty, 0) / count : null
  const wouldPct     = count > 0
    ? Math.round(reviews.filter((r) => r.would_recommend).length / count * 100)
    : null

  return (
    <div className="bg-[#f3f3f3] rounded-2xl p-5 mb-5 space-y-4">
      {/* Rating headline */}
      <div className="flex items-center gap-3">
        {avgRating !== null ? (
          <>
            <span className="text-3xl font-extrabold text-[#23389c]">{avgRating.toFixed(1)}</span>
            <div>
              <StarRow value={Math.round(avgRating)} />
              <p className="text-xs text-muted-foreground mt-0.5">{count} {count === 1 ? "review" : "reviews"}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet</p>
        )}
      </div>

      {/* Bars */}
      {avgDiff !== null && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">Difficulty</span>
            <span className="text-foreground font-bold">{avgDiff.toFixed(1)} / 5</span>
          </div>
          <div className="h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
            <div className="h-full bg-[#23389c] rounded-full" style={{ width: `${(avgDiff / 5) * 100}%` }} />
          </div>
        </div>
      )}

      {wouldPct !== null && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">Would Recommend</span>
            <span className="text-foreground font-bold">{wouldPct}%</span>
          </div>
          <div className="h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${wouldPct}%` }} />
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onWrite}
        className="w-full bg-[#23389c] text-white font-bold py-3 rounded-xl shadow-md shadow-[#23389c]/20 active:scale-[0.98] transition-transform"
      >
        {hasOwnReview ? "Edit Your Review" : "Write a Review"}
      </button>
    </div>
  )
}

function ReviewCard({
  review,
  isOwn,
  courseId,
  onEdit,
}: {
  review: Review
  isOwn: boolean
  courseId: string
  onEdit?: () => void
}) {
  const prosList = review.pros?.split("\n").map((s) => s.trim()).filter(Boolean) ?? []
  const consList = review.cons?.split("\n").map((s) => s.trim()).filter(Boolean) ?? []
  const [confirming, setConfirming] = useState(false)
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      await deleteReview(courseId)
      setConfirming(false)
    })
  }

  return (
    <article className={cn("bg-white rounded-3xl p-5 space-y-4 border shadow-sm", isOwn ? "border-[#23389c]/30 ring-1 ring-[#23389c]/20" : "border-border/40")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0", isOwn ? "bg-[#23389c] text-white" : avatarColor(review.user_id))}>
            {isOwn ? "You" : userInitials(review.user_id)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground leading-none">{isOwn ? "Your Review" : "Student"}</p>
              {isOwn && !confirming && (
                <button
                  onClick={onEdit}
                  className="text-[10px] font-bold text-[#23389c] bg-[#23389c]/10 px-2 py-0.5 rounded-lg hover:bg-[#23389c]/20 transition-colors"
                >
                  Edit
                </button>
              )}
              {isOwn && !confirming && (
                <button
                  onClick={() => setConfirming(true)}
                  className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-0.5"
                >
                  <Trash2 className="h-2.5 w-2.5" /> Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {[review.semester, review.grade && review.grade !== "in_progress" ? `Grade: ${review.grade}` : review.grade === "in_progress" ? "In Progress" : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <StarRow value={review.rating} />
          {review.grade && (
            <span className="mt-1 inline-block bg-[#23389c]/10 text-[#23389c] text-[10px] font-bold px-2 py-0.5 rounded-lg">
              {review.grade === "in_progress" ? "In Progress" : `Grade: ${review.grade}`}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="bg-[#f3f3f3] text-muted-foreground text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
          Difficulty {review.difficulty}/5
        </span>
        <span className="bg-[#f3f3f3] text-muted-foreground text-[10px] font-bold px-2.5 py-1 rounded-full">
          {workloadLabel(review.workload)}
        </span>
        <span className="bg-[#f3f3f3] text-muted-foreground text-[10px] font-bold px-2.5 py-1 rounded-full">
          {examTypeLabel(review.exam_type, review.exam_type_other)}
        </span>
      </div>

      {/* Body */}
      <p className="text-sm text-foreground leading-relaxed">{review.body}</p>

      {/* Pros */}
      {prosList.length > 0 && (
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2 flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" /> Pros
          </p>
          <ul className="space-y-1.5">
            {prosList.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-green-800/80 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cons */}
      {consList.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5 rotate-180" /> Cons
          </p>
          <ul className="space-y-1.5">
            {consList.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-red-800/80 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      {review.tips && (
        <div className="bg-[#23389c]/5 rounded-2xl p-4 border border-[#23389c]/10">
          <p className="text-xs font-bold text-[#23389c] uppercase tracking-widest mb-2 flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5" /> Tips for Success
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed italic">{review.tips}</p>
        </div>
      )}

      {/* Delete confirmation */}
      {isOwn && confirming && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-red-700">Remove your review? This can't be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 text-white text-sm font-bold py-2 rounded-xl disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {deleting ? "Removing…" : "Yes, Remove"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex-1 bg-white text-foreground text-sm font-bold py-2 rounded-xl border border-border active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function CourseDetailTabs({
  campusnetCourseId,
  campusnetCourse,
  offerings,
  resources,
  reviews,
  questions,
  currentUserId,
  semesters,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview")
  const [showReviewSheet, setShowReviewSheet] = useState(false)

  const ownReview = reviews.find((r) => r.user_id === currentUserId) ?? null
  // Own review always first, then rest sorted by date (server already sorted desc)
  const sortedReviews = ownReview
    ? [ownReview, ...reviews.filter((r) => r.user_id !== currentUserId)]
    : reviews

  const semesterMap = groupBySemester(offerings)

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-border mb-5">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === tab
                ? "text-[#23389c] border-b-2 border-[#23389c] -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
            {tab === "Reviews" && reviews.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-[#23389c]/10 text-[#23389c] px-1.5 py-0.5 rounded-full font-bold">
                {reviews.length}
              </span>
            )}
            {tab === "Q&A" && questions.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-[#23389c]/10 text-[#23389c] px-1.5 py-0.5 rounded-full font-bold">
                {questions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {activeTab === "Overview" && (
        <div className="space-y-4">
          <div className="bg-[#f3f3f3] rounded-2xl p-4 space-y-2">
            {campusnetCourse.school && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-24 pt-0.5 shrink-0">School</span>
                <span className="text-sm font-medium text-foreground">{campusnetCourse.school}</span>
              </div>
            )}
            {campusnetCourse.curriculum_type && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-24 pt-0.5 shrink-0">Curriculum</span>
                <span className="text-sm font-medium text-foreground">{campusnetCourse.curriculum_type}</span>
              </div>
            )}
          </div>

          {semesterMap.size > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Offered In</h3>
              <div className="space-y-2">
                {Array.from(semesterMap.entries()).map(([semester, offs]) => (
                  <div key={semester} className="bg-[#f3f3f3] rounded-2xl p-4">
                    <p className="text-sm font-semibold text-foreground mb-2">{semester}</p>
                    <div className="space-y-1">
                      {offs.map((o) => (
                        <div key={o.id} className="flex items-center gap-2">
                          {o.offering_number && (
                            <span className="text-xs font-mono text-[#23389c] bg-[#23389c]/10 px-2 py-0.5 rounded-lg">
                              {o.offering_number}
                            </span>
                          )}
                          {o.course_type && (
                            <span className="text-xs text-muted-foreground">{o.course_type}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={BookOpen} text="No semester offerings recorded yet." />
          )}
        </div>
      )}

      {/* ── Resources ────────────────────────────────────────────────────────── */}
      {activeTab === "Resources" && (
        resources.length === 0 ? (
          <EmptyState icon={FileText} text="No resources yet — be the first to share notes." />
        ) : (
          <div className="space-y-3">
            {resources.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-border/50 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#23389c]/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-[#23389c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  <span className="mt-1 inline-block text-[10px] bg-[#23389c]/10 text-[#23389c] px-2 py-0.5 rounded-lg font-bold uppercase">{r.type}</span>
                </div>
                {r.file_url && (
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-[#23389c] hover:opacity-70 shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Reviews ──────────────────────────────────────────────────────────── */}
      {activeTab === "Reviews" && (
        <div className="space-y-4">
          <ReviewSummary
            reviews={reviews}
            hasOwnReview={!!ownReview}
            onWrite={() => setShowReviewSheet(true)}
          />

          {sortedReviews.length === 0 ? (
            <EmptyState icon={Star} text="No reviews yet — be the first to review this course." />
          ) : (
            sortedReviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                isOwn={r.user_id === currentUserId}
                courseId={campusnetCourseId}
                onEdit={() => setShowReviewSheet(true)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Q&A ──────────────────────────────────────────────────────────────── */}
      {activeTab === "Q&A" && (
        questions.length === 0 ? (
          <EmptyState icon={MessageCircle} text="No questions yet — ask the first question!" />
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl p-4 border border-border/50 space-y-2">
                <div className="flex items-start gap-2">
                  {q.is_resolved && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-bold uppercase shrink-0">
                      Resolved
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground leading-snug">{q.title}</p>
                </div>
                {q.body && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{q.body}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {q.answer_count} {q.answer_count === 1 ? "answer" : "answers"}
                  </span>
                  <span>{new Date(q.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Write / Edit Review Sheet */}
      {showReviewSheet && (
        <WriteReviewSheet
          courseId={campusnetCourseId}
          semesters={semesters}
          initialData={ownReview ?? undefined}
          onClose={() => setShowReviewSheet(false)}
          onSuccess={() => setShowReviewSheet(false)}
        />
      )}
    </div>
  )
}
