"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { YearOfStudy } from "@/lib/types/database"

export interface OnboardingFormData {
  full_name:     string
  faculty:       string
  major:         string
  year_of_study: YearOfStudy
}

export async function completeOnboarding(data: OnboardingFormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/login")

  // ── 1. Update the profiles row ─────────────────────────────────────────────
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name:           data.full_name.trim(),
      faculty:             data.faculty,
      major:               data.major.trim(),
      year_of_study:       data.year_of_study,
      onboarding_complete: true,
    })
    .eq("id", user.id)

  if (profileError) {
    // Surface the error so the client can display it
    return { error: profileError.message }
  }

  // ── 2. Mirror completion flag into user_metadata ───────────────────────────
  // Middleware reads user_metadata to avoid a DB round-trip on every request.
  // This keeps the session JWT in sync with the profile state.
  await supabase.auth.updateUser({
    data: { onboarding_complete: true },
  })

  redirect("/home")
}
