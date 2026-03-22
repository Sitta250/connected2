import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// ─── Route classification ──────────────────────────────────────────────────────

// No session required; authenticated users are redirected away from these.
const AUTH_ROUTES = ["/login", "/signup"]

// Always reachable (no redirect regardless of auth/onboarding state).
const ALWAYS_PUBLIC = ["/auth/callback"]

// Requires auth but NOT onboarding completion (the onboarding page itself).
const ONBOARDING_ROUTE = "/onboarding"

// ─── Middleware ────────────────────────────────────────────────────────────────
//
// Routing logic:
//
//   1. No session  + protected route  → /login
//   2. No session  + auth route       → pass (show login/signup)
//   3. Session     + auth route       → /home  (already signed in)
//   4. Session     + /onboarding      → pass if not complete; /home if already done
//   5. Session     + protected route  + incomplete onboarding → /onboarding
//   6. Everything else                → pass
//
// Onboarding state is read from user_metadata (set by the onboarding server
// action via supabase.auth.updateUser) — no extra DB query needed.

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT server-side and refreshes the session cookie.
  // This is the recommended Supabase SSR pattern — never use getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute      = AUTH_ROUTES.some((r) => pathname.startsWith(r))
  const isAlwaysPublic   = ALWAYS_PUBLIC.some((r) => pathname.startsWith(r))
  const isOnboardingRoute = pathname.startsWith(ONBOARDING_ROUTE)

  // ── 1 & 2: No session ──────────────────────────────────────────────────────
  if (!user) {
    if (isAuthRoute || isAlwaysPublic) return supabaseResponse
    return redirect(request, supabaseResponse, "/login")
  }

  // ── 3: Signed in, hits auth page ───────────────────────────────────────────
  if (isAuthRoute) {
    return redirect(request, supabaseResponse, "/home")
  }

  // ── Always-public passes through regardless of auth state ──────────────────
  if (isAlwaysPublic) return supabaseResponse

  // ── 4 & 5: Onboarding gate ─────────────────────────────────────────────────
  const onboardingComplete =
    user.user_metadata?.onboarding_complete === true

  if (isOnboardingRoute) {
    // Already onboarded → skip back to the app
    if (onboardingComplete) return redirect(request, supabaseResponse, "/home")
    return supabaseResponse
  }

  if (!onboardingComplete) {
    // Not yet onboarded → send to onboarding
    return redirect(request, supabaseResponse, "/onboarding")
  }

  // ── 6: All good ────────────────────────────────────────────────────────────
  return supabaseResponse
}

function redirect(
  request: NextRequest,
  response: NextResponse,
  to: string
): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = to
  const res = NextResponse.redirect(url)
  // Copy any updated session cookies from the supabase response
  response.cookies.getAll().forEach((c) => res.cookies.set(c))
  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
