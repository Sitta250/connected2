"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface ReviewFormData {
  courseId:       string
  rating:         number
  difficulty:     number
  workload:       "light" | "moderate" | "heavy" | "very_heavy"
  examType:       "paper" | "online" | "project" | "presentation" | "other"
  examTypeOther?: string
  body:           string
  pros?:          string
  cons?:          string
  tips?:          string
  grade?:         string
  semester?:      string
  wouldRecommend: boolean
}

export async function submitReview(data: ReviewFormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const payload = {
    course_id:        data.courseId,
    user_id:          user.id,
    rating:           data.rating,
    difficulty:       data.difficulty,
    workload:         data.workload,
    exam_type:        data.examType,
    exam_type_other:  data.examType === "other" ? (data.examTypeOther ?? null) : null,
    body:             data.body.trim(),
    pros:             data.pros?.trim() || null,
    cons:             data.cons?.trim() || null,
    tips:             data.tips?.trim() || null,
    grade:            data.grade || null,
    semester:         data.semester?.trim() || null,
    would_recommend:  data.wouldRecommend,
  }

  const { error } = await supabase
    .from("campusnet_course_reviews")
    .upsert(payload, { onConflict: "course_id,user_id" })

  if (error) return { error: error.message }

  revalidatePath(`/courses/${data.courseId}`)
  return {}
}

export async function voteReview(reviewId: string, vote: 1 | -1): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch existing vote
  const { data: existing } = await supabase
    .from("campusnet_review_votes")
    .select("vote")
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing?.vote === vote) {
    // Same vote → toggle off
    await supabase
      .from("campusnet_review_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
  } else {
    await supabase
      .from("campusnet_review_votes")
      .upsert({ review_id: reviewId, user_id: user.id, vote }, { onConflict: "review_id,user_id" })
  }

  return {}
}

export async function deleteReview(courseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("campusnet_course_reviews")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath(`/courses/${courseId}`)
  return {}
}
