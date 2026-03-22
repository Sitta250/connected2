"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Lock, ArrowLeft, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const DOMAIN = "constructor.university"

type Mode = "magic" | "password"
type MagicState = "idle" | "sent"

export default function LoginPage() {
  const [mode, setMode]           = useState<Mode>("magic")
  const [email, setEmail]         = useState("")
  const [password, setPassword]   = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [magicState, setMagicState] = useState<MagicState>("idle")

  // Validate domain before hitting Supabase
  function validateEmail(value: string): string | null {
    if (!value.endsWith(`@${DOMAIN}`)) {
      return `Only @${DOMAIN} email addresses are allowed.`
    }
    return null
  }

  // ── Magic link ──────────────────────────────────────────────────────────────
  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    const domainError = validateEmail(email)
    if (domainError) { setError(domainError); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // login only — signup has its own page
      },
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    setMagicState("sent")
  }

  // ── Password ─────────────────────────────────────────────────────────────────
  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    const domainError = validateEmail(email)
    if (domainError) { setError(domainError); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    // middleware handles the redirect to /home or /onboarding
    window.location.href = "/home"
  }

  // ── Magic-link sent state ─────────────────────────────────────────────────
  if (magicState === "sent") {
    return (
      <div className="space-y-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#23389c]/10 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-[#23389c]" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
            Click it to continue — no password needed.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Link expires in 60 minutes.{" "}
          <button
            onClick={() => { setMagicState("idle"); setError(null) }}
            className="text-[#23389c] font-medium hover:underline"
          >
            Send again
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Sign in</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Use your Constructor University email
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-[#f3f3f3] p-1 gap-1">
        {(["magic", "password"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null) }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
              mode === m
                ? "bg-white text-[#23389c] shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "magic"
              ? <><Mail className="h-3.5 w-3.5" /> Magic link</>
              : <><Lock className="h-3.5 w-3.5" /> Password</>
            }
          </button>
        ))}
      </div>

      {/* Email field (shared) */}
      <form
        onSubmit={mode === "magic" ? sendMagicLink : signInWithPassword}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">University Email</Label>
          {/* Suffix-anchored input: user sees their handle, domain is fixed */}
          <div className="flex rounded-xl overflow-hidden bg-[#f3f3f3] focus-within:ring-2 focus-within:ring-[#23389c]">
            <input
              id="email"
              type="text"
              placeholder="your.name"
              value={email.replace(`@${DOMAIN}`, "")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s/g, "")
                // Allow full email paste (e.g. from autocomplete)
                setEmail(raw.includes("@") ? raw : `${raw}@${DOMAIN}`)
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
        </div>

        {/* Password field — only shown in password mode */}
        {mode === "password" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-[#f3f3f3] border-0 focus-visible:ring-[#23389c]"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full gradient-primary text-white border-0 font-medium h-11"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "magic" ? (
            "Send magic link"
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="text-[#23389c] font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
