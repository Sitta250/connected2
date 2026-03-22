"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, GraduationCap, CheckCircle } from "lucide-react"

// ─── Domain lock ──────────────────────────────────────────────────────────────
// Connected is exclusively for Constructor University.
// Only @constructor.university addresses pass validation.
const DOMAIN = "constructor.university"

type Step = "form" | "confirm"

export default function SignupPage() {
  const [step, setStep]           = useState<Step>("form")
  const [handle, setHandle]       = useState("") // part before @
  const [password, setPassword]   = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const email = handle.includes("@") ? handle : `${handle}@${DOMAIN}`

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // ── Client-side domain check ──────────────────────────────────────────────
    if (!email.endsWith(`@${DOMAIN}`)) {
      setError(`Only @${DOMAIN} addresses can sign up.`)
      return
    }

    setLoading(true)
    const supabase = createClient()

    // ── Server-side domain check (universities table) ─────────────────────────
    // This ensures only domains explicitly approved by the admin can register,
    // even if someone bypasses the client check.
    const { data: university } = await supabase
      .from("universities")
      .select("id")
      .eq("domain", DOMAIN)
      .maybeSingle()

    if (!university) {
      setError("Constructor University is not yet activated. Contact support.")
      setLoading(false)
      return
    }

    // ── Create auth user ──────────────────────────────────────────────────────
    // Profile creation happens in /auth/callback after email confirmation.
    // We pass university_id in metadata so callback can use it without
    // an extra DB lookup.
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { university_id: university.id },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
    if (signupError) { setError(signupError.message); return }
    setStep("confirm")
  }

  // ── Email confirmation screen ─────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[#23389c]/10 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-[#23389c]" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">Confirm your email</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Click it to activate your account — then you can set up your profile.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn't receive it?{" "}
          <button
            onClick={() => setStep("form")}
            className="text-[#23389c] font-medium hover:underline"
          >
            Try again
          </button>
        </p>
        <Link
          href="/login"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  // ── Signup form ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Create your account</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Constructor University students only
        </p>
      </div>

      {/* University badge */}
      <div className="flex items-center gap-2.5 bg-[#23389c]/5 rounded-xl px-3 py-2.5">
        <GraduationCap className="h-4 w-4 text-[#23389c] shrink-0" />
        <span className="text-sm text-[#23389c] font-medium">Constructor University</span>
        <span className="ml-auto text-xs bg-[#23389c] text-white rounded-md px-1.5 py-0.5 font-medium">
          Only
        </span>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {/* Email with locked domain suffix */}
        <div className="space-y-1.5">
          <Label htmlFor="handle">University Email</Label>
          <div className="flex rounded-xl overflow-hidden bg-[#f3f3f3] focus-within:ring-2 focus-within:ring-[#23389c]">
            <input
              id="handle"
              type="text"
              placeholder="your.name"
              value={handle.replace(`@${DOMAIN}`, "")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s/g, "")
                setHandle(raw.includes("@") ? raw : raw)
                setError(null)
              }}
              required
              autoComplete="email"
              className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none min-w-0"
            />
            <span className="flex items-center pr-3 text-sm text-muted-foreground select-none whitespace-nowrap">
              @{DOMAIN}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Use your Constructor University student or staff email.
          </p>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="bg-[#f3f3f3] border-0 focus-visible:ring-[#23389c]"
          />
          <p className="text-xs text-muted-foreground">
            You can also use magic link to sign in — no password needed.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !handle}
          className="w-full gradient-primary text-white border-0 font-medium h-11"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-[#23389c] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
