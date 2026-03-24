"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function submitResource(data: {
  courseId:    string
  title:       string
  description: string
  fileUrl:     string
  type:        string
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("campusnet_course_resources")
    .insert({
      course_id:   data.courseId,
      user_id:     user.id,
      title:       data.title.trim(),
      description: data.description.trim() || null,
      file_url:    data.fileUrl,
      type:        data.type,
    })

  if (error) return { error: error.message }

  revalidatePath(`/courses/${data.courseId}`)
  return {}
}
