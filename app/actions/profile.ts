"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateProfile(data: {
  fullName:        string
  bio:             string
  yearOfStudy:     string
  graduationYear:  number | null
  interests:       string[]
  avatarUrl?:      string
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name:       data.fullName.trim(),
      bio:             data.bio.trim() || null,
      year_of_study:   (data.yearOfStudy || null) as string | null,
      graduation_year: data.graduationYear,
      interests:       data.interests,
      updated_at:      new Date().toISOString(),
      ...(data.avatarUrl !== undefined && { avatar_url: data.avatarUrl }),
    })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/profile")
  return {}
}
