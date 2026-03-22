import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Handles both email-confirmation links and magic-link clicks.
// After the code exchange Supabase sets the session cookie automatically.
// We then:
//  1. Create a stub profile row if this is a first-time signup.
//  2. Redirect to /onboarding (new users) or /home (returning users).

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    console.error("[auth/callback] Supabase returned error:", error)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError)
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  const user  = data.user
  const email = user.email!

  // ── 1. Ensure a profile row exists ──────────────────────────────────────────
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle()

  if (!existingProfile) {
    // Resolve university from email domain
    const domain = email.split("@")[1]
    const { data: university } = await supabase
      .from("universities")
      .select("id")
      .eq("domain", domain)
      .maybeSingle()

    await supabase.from("profiles").insert({
      id:               user.id,
      university_id:    university?.id ?? null,
      university_email: email,
      full_name:        user.user_metadata?.full_name ?? "",
      onboarding_complete: false,
    })
  }

  // ── 2. Redirect ──────────────────────────────────────────────────────────────
  // user_metadata is the source of truth for middleware — check it here too
  // so returning users who already completed onboarding go straight to /home.
  const onboardingDone =
    existingProfile?.onboarding_complete === true ||
    user.user_metadata?.onboarding_complete === true

  return NextResponse.redirect(
    onboardingDone ? `${origin}/home` : `${origin}/onboarding`
  )
}
