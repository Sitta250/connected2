"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, Star, MessageCircle, BookOpen, ExternalLink, ThumbsUp, Lightbulb, Trash2, ChevronUp, ChevronDown, Upload, CheckCircle2, MessageSquarePlus, Download, X } from "lucide-react"
import { WriteReviewSheet } from "./write-review-sheet"
import { deleteReview, voteReview } from "@/app/actions/review"
import { submitQuestion } from "@/app/actions/question"
// submitResource server action unused — insert done client-side for reliable auth
import { createClient } from "@/lib/supabase/client"
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
  user_id:     string
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
  net_votes:       number          // pre-computed server-side
  my_vote:         0 | 1 | -1     // current user's vote
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function resourceIcon(type: string) {
  const t = type.toLowerCase()
  if (t === "pdf") return { bg: "bg-red-50", text: "text-red-600", label: "PDF" }
  if (t === "slides" || t === "ppt" || t === "pptx") return { bg: "bg-orange-50", text: "text-orange-600", label: "PPT" }
  if (t === "code" || t === "notebook") return { bg: "bg-emerald-50", text: "text-emerald-600", label: "CODE" }
  if (t === "video") return { bg: "bg-purple-50", text: "text-purple-600", label: "VID" }
  return { bg: "bg-blue-50", text: "text-blue-600", label: type.toUpperCase().slice(0, 4) }
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
  const [myVote, setMyVote] = useState<0 | 1 | -1>(review.my_vote)
  const [voting, startVote] = useTransition()

  function handleVote(v: 1 | -1) {
    const next: 0 | 1 | -1 = myVote === v ? 0 : v
    setMyVote(next)
    startVote(async () => {
      await voteReview(review.id, v)
    })
  }

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

      {/* Vote buttons — only shown to other users (not own review) */}
      {!isOwn && (
        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={() => handleVote(1)}
            disabled={voting}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors",
              myVote === 1
                ? "bg-[#23389c] text-white"
                : "bg-[#f3f3f3] text-muted-foreground hover:bg-[#e8e8e8]"
            )}
          >
            <ChevronUp className="h-3.5 w-3.5" />
            Helpful
          </button>
          <button
            onClick={() => handleVote(-1)}
            disabled={voting}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors",
              myVote === -1
                ? "bg-red-500 text-white"
                : "bg-[#f3f3f3] text-muted-foreground hover:bg-[#e8e8e8]"
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Not Helpful
          </button>
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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("Overview")
  const [showReviewSheet, setShowReviewSheet] = useState(false)
  const [showAskSheet, setShowAskSheet] = useState(false)
  const [showUploadSheet, setShowUploadSheet] = useState(false)

  const ownReview = reviews.find((r) => r.user_id === currentUserId) ?? null
  // Reviews already sorted server-side: own first, then by net votes desc
  const sortedReviews = reviews

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
        <div className="space-y-4">
          {/* Upload button — always at top */}
          <button
            onClick={() => setShowUploadSheet(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#23389c] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#23389c]/20 active:scale-[0.98] transition-transform"
          >
            <Upload className="h-4 w-4" />
            Upload Resource
          </button>

          {resources.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/60 p-12 flex flex-col items-center text-center mt-2">
              <div className="w-16 h-16 rounded-full bg-[#23389c]/8 flex items-center justify-center mb-4">
                <Upload className="h-7 w-7 text-[#23389c]" />
              </div>
              <p className="font-bold text-base text-foreground mb-1">Be the first to share notes</p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Help your peers by uploading lecture notes, cheat sheets, or past exam preps.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resources.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  isOwn={r.user_id === currentUserId}
                  onDeleted={() => router.refresh()}
                />
              ))}
            </div>
          )}
        </div>
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
        <div className="space-y-4">
          {/* Ask a question button — always at top */}
          <button
            onClick={() => setShowAskSheet(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#23389c] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#23389c]/20 active:scale-[0.98] transition-transform"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Start a Question
          </button>

          {questions.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/60 p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#23389c]/8 flex items-center justify-center mb-4">
                <MessageCircle className="h-7 w-7 text-[#23389c]" />
              </div>
              <p className="font-bold text-base text-foreground mb-1">No questions yet</p>
              <p className="text-sm text-muted-foreground">Be the first to start a discussion for this course.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className={cn(
                    "bg-white rounded-2xl p-5 border shadow-sm transition-shadow hover:shadow-md",
                    q.is_resolved ? "border-green-200" : "border-border/40"
                  )}
                >
                  {/* Meta row */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    {q.is_resolved && (
                      <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-lg font-bold uppercase text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Resolved
                      </span>
                    )}
                    <span>{timeAgo(q.created_at)}</span>
                  </div>

                  {/* Title */}
                  <p className="text-base font-bold text-foreground leading-snug mb-1">{q.title}</p>

                  {/* Body preview */}
                  {q.body && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">{q.body}</p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground pt-2 border-t border-border/30">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {q.answer_count} {q.answer_count === 1 ? "answer" : "answers"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

      {/* Ask Question Sheet */}
      {showAskSheet && (
        <AskQuestionSheet courseId={campusnetCourseId} onClose={() => setShowAskSheet(false)} />
      )}

      {/* Upload Resource Sheet */}
      {showUploadSheet && (
        <UploadResourceSheet courseId={campusnetCourseId} onClose={() => setShowUploadSheet(false)} />
      )}
    </div>
  )
}

// ── Resource Card ─────────────────────────────────────────────────────────────

function ResourceCard({
  resource,
  isOwn,
  onDeleted,
}: {
  resource: Resource
  isOwn: boolean
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const icon = resourceIcon(resource.type)

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from("campusnet_course_resources").delete().eq("id", resource.id)
    onDeleted()
  }

  return (
    <div className={cn(
      "bg-white rounded-2xl p-4 border shadow-sm hover:-translate-y-0.5 transition-transform",
      isOwn ? "border-[#23389c]/20" : "border-border/40"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xs font-extrabold", icon.bg, icon.text)}>
          {icon.label}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-snug">{resource.title}</p>
          {resource.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{resource.description}</p>
          )}
          <span className={cn("mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase", icon.bg, icon.text)}>
            {resource.type}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isOwn && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {resource.file_url && (
            <a
              href={resource.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-[#23389c]/8 text-[#23389c] flex items-center justify-center hover:bg-[#23389c] hover:text-white transition-colors"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirming && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2">
          <p className="text-xs font-semibold text-red-700 flex-1">Delete this resource?</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="text-xs font-bold text-foreground bg-white border border-border px-3 py-1.5 rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Ask Question Sheet ────────────────────────────────────────────────────────

function AskQuestionSheet({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [body,  setBody]  = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError("Please enter a title for your question.")
    setError(null)
    startTransition(async () => {
      const result = await submitQuestion(courseId, title, body)
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-t-3xl max-h-[85dvh] overflow-y-auto pb-28">
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-border/50 px-5 pt-4 pb-3 z-10">
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Start a Question</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-[#f3f3f3]">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="px-5 pt-5 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Question Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. How hard is the final project?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#f3f3f3] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Details <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="Add more context to help others answer your question…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full bg-[#f3f3f3] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c] resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#23389c] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#23389c]/20 disabled:opacity-60 transition-opacity active:scale-[0.98]"
          >
            {pending ? "Posting…" : "Post Question"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Upload Resource Sheet ─────────────────────────────────────────────────────

const RESOURCE_TYPES = ["notes", "slides", "exam", "code", "pdf", "other"] as const

function UploadResourceSheet({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const router = useRouter()
  const [files,       setFiles]       = useState<File[]>([])
  const [description, setDescription] = useState("")
  const [type,        setType]        = useState<string>("notes")
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...selected.filter((f) => !existing.has(f.name))]
    })
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return setError("Please select at least one file.")
    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("Not authenticated."); setUploading(false); return }

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`)

        const ext  = file.name.split(".").pop() ?? "bin"
        const path = `${courseId}/${Date.now()}-${i}.${ext}`

        const { error: storageErr } = await supabase.storage
          .from("course-resources")
          .upload(path, file, { upsert: false })

        if (storageErr) { setError(storageErr.message); setUploading(false); setProgress(null); return }

        const { data: { publicUrl } } = supabase.storage
          .from("course-resources")
          .getPublicUrl(path)

        // Title: filename without extension
        const autoTitle = file.name.replace(/\.[^.]+$/, "")

        const { error: dbErr } = await supabase
          .from("campusnet_course_resources")
          .insert({
            course_id:   courseId,
            user_id:     user.id,
            title:       autoTitle,
            description: description.trim() || null,
            file_url:    publicUrl,
            type,
          })

        if (dbErr) { setError(dbErr.message); setUploading(false); setProgress(null); return }
      }

      router.refresh()
      onClose()
    } catch (err) {
      setError(String(err))
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-t-3xl max-h-[90dvh] overflow-y-auto pb-28">
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-border/50 px-5 pt-4 pb-3 z-10">
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Upload Resources</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-[#f3f3f3]">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="px-5 pt-5 space-y-5">

          {/* Drop zone */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Files <span className="text-red-500">*</span>
            </label>
            <label className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 cursor-pointer transition-colors",
              files.length > 0 ? "border-[#23389c]/40 bg-[#23389c]/5" : "border-border hover:border-[#23389c]/40"
            )}>
              <Upload className={cn("h-7 w-7", files.length > 0 ? "text-[#23389c]" : "text-muted-foreground")} />
              <span className="text-sm font-medium text-foreground">
                {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Tap to choose files"}
              </span>
              <span className="text-xs text-muted-foreground">You can select multiple files</span>
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-3 bg-[#f3f3f3] rounded-xl px-3 py-2.5">
                  <FileText className="h-4 w-4 text-[#23389c] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(f.name)}
                    className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</label>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize",
                    type === t
                      ? "bg-[#23389c] text-white border-[#23389c]"
                      : "bg-[#f3f3f3] text-foreground border-transparent hover:bg-[#e8e8e8]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Description <span className="text-muted-foreground/50 normal-case font-normal">(optional — applies to all files)</span>
            </label>
            <textarea
              placeholder="Brief description of what these files cover…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#f3f3f3] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c] resize-none"
            />
          </div>

          {progress && (
            <p className="text-xs text-[#23389c] bg-[#23389c]/5 rounded-xl px-4 py-3 font-medium">{progress}</p>
          )}
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-[#23389c] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#23389c]/20 disabled:opacity-60 transition-opacity active:scale-[0.98]"
          >
            {uploading ? (progress ?? "Uploading…") : `Upload ${files.length > 1 ? `${files.length} Files` : "Resource"}`}
          </button>
        </div>
      </form>
    </div>
  )
}
