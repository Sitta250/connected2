import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { CourseDetailTabs } from "@/components/features/course-detail-tabs"
import type { Offering, Resource, Review, Question } from "@/components/features/course-detail-tabs"

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ── Fetch campusnet course ────────────────────────────────────────────────

  const { data: campusnetCourse } = await supabase
    .from("campusnet_courses")
    .select("id, module_number, name, school, curriculum_type")
    .eq("id", id)
    .maybeSingle()

  if (!campusnetCourse) notFound()

  // ── Fetch offerings + instructors in parallel ─────────────────────────────

  const [{ data: offeringsRaw }, coursesMatchResult] = await Promise.all([
    supabase
      .from("course_offerings")
      .select("id, semester, offering_number, name, course_type")
      .eq("course_id", id)
      .order("semester", { ascending: false }),

    campusnetCourse.module_number
      ? supabase
          .from("courses")
          .select("id")
          .eq("code", campusnetCourse.module_number)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const offerings: Offering[] = (offeringsRaw ?? []) as Offering[]

  // Derive the latest semester for the meta line
  const latestSemester = offerings.length > 0 ? offerings[0].semester : null

  // ── Fetch distinct instructor names ──────────────────────────────────────

  const offeringIds = offerings.map((o) => o.id)

  let instructorNames: string[] = []
  if (offeringIds.length > 0) {
    const { data: instrRows } = await supabase
      .from("course_offering_instructors")
      .select("instructors(name)")
      .in("course_offering_id", offeringIds)

    if (instrRows) {
      const seen = new Set<string>()
      for (const row of instrRows) {
        const instr = row.instructors as { name: string } | { name: string }[] | null
        if (!instr) continue
        if (Array.isArray(instr)) {
          for (const i of instr) if (i.name) seen.add(i.name)
        } else {
          if (instr.name) seen.add(instr.name)
        }
      }
      instructorNames = Array.from(seen).sort()
    }
  }

  // ── Fetch campusnet reviews + resources/questions from matched course ──────

  const matchedCourseId: string | null = coursesMatchResult.data?.id ?? null

  let reviews: Review[] = []
  let resources: Resource[] = []
  let questions: Question[] = []

  // Distinct semesters from offerings for the review form picker
  const semesters = Array.from(
    new Set((offeringsRaw ?? []).map((o) => o.semester).filter(Boolean))
  ) as string[]

  const [reviewsRes, resourcesQuestionsResult] = await Promise.all([
    supabase
      .from("campusnet_course_reviews")
      .select("id, user_id, rating, difficulty, workload, exam_type, exam_type_other, body, pros, cons, tips, grade, semester, would_recommend, created_at")
      .eq("course_id", id)
      .order("created_at", { ascending: false }),

    Promise.all([
      supabase
        .from("campusnet_course_resources")
        .select("id, title, description, file_url, type, user_id")
        .eq("course_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("campusnet_course_questions")
        .select("id, title, body, is_resolved, created_at, user_id")
        .eq("course_id", id)
        .order("created_at", { ascending: false }),
    ]),
  ])

  const rawReviews = reviewsRes.data ?? []

  // Fetch votes for these reviews in parallel
  const reviewIds = rawReviews.map((r) => r.id)
  const { data: votesRaw } = reviewIds.length > 0
    ? await supabase
        .from("campusnet_review_votes")
        .select("review_id, user_id, vote")
        .in("review_id", reviewIds)
    : { data: [] }

  // Compute net votes and current user's vote per review
  const voteMap = new Map<string, { net: number; myVote: 0 | 1 | -1 }>()
  for (const v of (votesRaw ?? [])) {
    if (!voteMap.has(v.review_id)) voteMap.set(v.review_id, { net: 0, myVote: 0 })
    const entry = voteMap.get(v.review_id)!
    entry.net += v.vote
    if (v.user_id === user.id) entry.myVote = v.vote as 1 | -1
  }

  // Enrich reviews with vote data, then sort: own first, then by net votes desc
  reviews = rawReviews
    .map((r) => ({
      ...r,
      net_votes: voteMap.get(r.id)?.net ?? 0,
      my_vote:   voteMap.get(r.id)?.myVote ?? 0,
    }))
    .sort((a, b) => {
      if (a.user_id === user.id) return -1
      if (b.user_id === user.id) return 1
      return b.net_votes - a.net_votes
    }) as Review[]

  const [resourcesRes, questionsRes] = resourcesQuestionsResult
  resources = (resourcesRes.data ?? []) as Resource[]

  const rawQuestions = questionsRes.data ?? []

  // Fetch answer counts + votes for all questions in parallel
  const questionIds = rawQuestions.map((q) => q.id)
  const [answerCountsRes, questionVotesRes] = await Promise.all([
    questionIds.length > 0
      ? supabase.from("campusnet_question_answers").select("question_id").in("question_id", questionIds)
      : Promise.resolve({ data: [] }),
    questionIds.length > 0
      ? supabase.from("campusnet_question_votes").select("question_id, user_id, vote").in("question_id", questionIds)
      : Promise.resolve({ data: [] }),
  ])

  const answerCountMap = new Map<string, number>()
  for (const row of (answerCountsRes.data ?? [])) {
    answerCountMap.set(row.question_id, (answerCountMap.get(row.question_id) ?? 0) + 1)
  }

  const qVoteMap = new Map<string, { net: number; myVote: 0 | 1 | -1 }>()
  for (const v of (questionVotesRes.data ?? [])) {
    if (!qVoteMap.has(v.question_id)) qVoteMap.set(v.question_id, { net: 0, myVote: 0 })
    const entry = qVoteMap.get(v.question_id)!
    entry.net += v.vote
    if (v.user_id === user.id) entry.myVote = v.vote as 1 | -1
  }

  questions = rawQuestions.map((q) => ({
    id:           q.id,
    title:        q.title,
    body:         q.body ?? null,
    is_resolved:  q.is_resolved ?? null,
    created_at:   q.created_at,
    answer_count: answerCountMap.get(q.id) ?? 0,
    user_id:      q.user_id,
    net_votes:    qVoteMap.get(q.id)?.net ?? 0,
    my_vote:      qVoteMap.get(q.id)?.myVote ?? 0,
  } satisfies Question))

  // ── Compute summary stats ─────────────────────────────────────────────────

  const reviewCount = reviews.length
  const avgDifficulty =
    reviewCount > 0
      ? (reviews.reduce((s, r) => s + r.difficulty, 0) / reviewCount).toFixed(1)
      : null
  const avgRating =
    reviewCount > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(1)
      : null
  const wouldTakeAgainPct =
    reviewCount > 0
      ? Math.round(
          (reviews.filter((r) => r.would_recommend === true).length / reviewCount) * 100
        )
      : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-12 pb-20">
      {/* Back nav */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Courses
      </Link>

      {/* Course meta */}
      <p className="text-xs font-semibold text-muted-foreground mb-1">
        {[latestSemester, campusnetCourse.module_number].filter(Boolean).join(" · ")}
      </p>

      {/* Course name */}
      <h1 className="font-display text-2xl font-bold text-foreground leading-tight mb-5">
        {campusnetCourse.name}
      </h1>

      {/* Decision Summary card */}
      <div className="bg-[#23389c] text-white rounded-3xl p-6 shadow-xl shadow-[#23389c]/20 mb-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/70 text-[10px] uppercase font-bold tracking-widest">
            Decision Summary
          </span>
          {reviewCount > 0 && (
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-1">
              Difficulty
            </p>
            <p className="text-2xl font-extrabold">
              {avgDifficulty ?? "--"}
              {avgDifficulty && <span className="text-base font-medium text-white/60"> / 5</span>}
            </p>
          </div>
          <div>
            <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-1">
              Rating
            </p>
            <p className="text-2xl font-extrabold">
              {avgRating ?? "--"}
              {avgRating && <span className="text-base font-medium text-white/60"> / 5</span>}
            </p>
          </div>
          <div>
            <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-1">
              Would Take Again
            </p>
            <p className="text-2xl font-extrabold">
              {wouldTakeAgainPct !== null ? `${wouldTakeAgainPct}%` : "--"}
            </p>
          </div>
          <div>
            <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-1">
              Reviews
            </p>
            <p className="text-2xl font-extrabold">{reviewCount}</p>
          </div>
        </div>

        {/* Instructors */}
        {instructorNames.length > 0 && (
          <div className="border-t border-white/20 pt-4">
            <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-2">
              {instructorNames.length === 1 ? "Instructor" : "Instructors"}
            </p>
            <div className="flex flex-wrap gap-2">
              {instructorNames.map((name) => (
                <span
                  key={name}
                  className="bg-white/15 text-white text-xs font-medium px-2.5 py-1 rounded-xl"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <CourseDetailTabs
        campusnetCourse={{
          school: campusnetCourse.school,
          curriculum_type: campusnetCourse.curriculum_type,
        }}
        offerings={offerings}
        resources={resources}
        reviews={reviews}
        questions={questions}
        campusnetCourseId={id}
        currentUserId={user.id}
        semesters={semesters}
      />
    </div>
  )
}
