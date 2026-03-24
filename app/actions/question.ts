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
