"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function submitQuestion(
  courseId: string,
  title: string,
  body: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("campusnet_course_questions")
    .insert({ course_id: courseId, user_id: user.id, title: title.trim(), body: body.trim() || null })

  if (error) return { error: error.message }

  revalidatePath(`/courses/${courseId}`)
  return {}
}

export async function deleteQuestion(
  questionId: string,
  courseId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("campusnet_course_questions")
    .delete()
    .eq("id", questionId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath(`/courses/${courseId}`)
  return {}
}

export async function voteQuestion(questionId: string, vote: 1 | -1): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: existing } = await supabase
    .from("campusnet_question_votes")
    .select("vote")
    .eq("question_id", questionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing?.vote === vote) {
    await supabase
      .from("campusnet_question_votes")
      .delete()
      .eq("question_id", questionId)
      .eq("user_id", user.id)
  } else {
    await supabase
      .from("campusnet_question_votes")
      .upsert({ question_id: questionId, user_id: user.id, vote }, { onConflict: "question_id,user_id" })
  }

  return {}
}

export async function submitAnswer(
  questionId: string,
  body: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("campusnet_question_answers")
    .insert({ question_id: questionId, user_id: user.id, body: body.trim() })

  if (error) return { error: error.message }

  return {}
}
