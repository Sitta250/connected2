import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { GraduationCap, Pencil, BookOpen, MessageCircle, FileText } from "lucide-react"
import { getInitials } from "@/lib/utils"
import { SignOutForm } from "@/components/features/sign-out-form"

const PROGRAM_LABEL: Record<string, string> = {
  "1": "Undergraduate", "2": "Undergraduate", "3": "Undergraduate", "4": "Undergraduate",
  masters: "Master's Student",
  phd:     "PhD Candidate",
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [profileRes, reviewsRes, resourcesRes, questionsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, bio, major, faculty, year_of_study, graduation_year, interests, university_email, universities(name)")
      .eq("id", user.id)
      .single(),
    supabase.from("campusnet_course_reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("campusnet_course_resources").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("campusnet_course_questions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ])

  const p = profileRes.data as {
    full_name:        string
    avatar_url:       string | null
    bio:              string | null
    major:            string | null
    faculty:          string | null
    year_of_study:    string | null
    graduation_year:  number | null
    interests:        string[] | null
    university_email: string
    universities:     { name: string } | null
  } | null

  const reviewCount   = reviewsRes.count   ?? 0
  const resourceCount = resourcesRes.count ?? 0
  const questionCount = questionsRes.count ?? 0

  const initials     = getInitials(p?.full_name ?? "?")
  const programLabel = p?.year_of_study ? (PROGRAM_LABEL[p.year_of_study] ?? null) : null
  const interests    = p?.interests ?? []

  return (
    <div className="px-4 pt-14 pb-28 max-w-md mx-auto">

      {/* ── Avatar ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-center mt-4 mb-5">
        <div className="relative">
          {p?.avatar_url ? (
            <img
              src={p.avatar_url}
              alt={p.full_name}
              className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-[#23389c]/10 border-4 border-white shadow-lg flex items-center justify-center text-[#23389c] text-3xl font-extrabold">
              {initials}
            </div>
          )}
          {/* Edit shortcut */}
          <Link
            href="/profile/edit"
            className="absolute bottom-1 right-1 w-9 h-9 bg-[#23389c] rounded-full flex items-center justify-center shadow-md border-2 border-white"
          >
            <Pencil className="h-3.5 w-3.5 text-white" />
          </Link>
        </div>
      </div>

      {/* ── Identity ────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-1 mb-4">
        <h1 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
          {p?.full_name || "Student"}
        </h1>

        {/* Program level */}
        {programLabel && (
          <p className="text-xs font-extrabold text-[#23389c] uppercase tracking-[0.15em]">
            {programLabel}{p?.major ? ` · ${p.major}` : ""}
          </p>
        )}

        {/* University */}
        {p?.universities?.name && (
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium mt-1">
            <GraduationCap className="h-3.5 w-3.5" />
            {p.universities.name}
          </div>
        )}

        {/* Class of YYYY */}
        {p?.graduation_year && (
          <p className="text-sm font-semibold text-muted-foreground">
            Class of {p.graduation_year}
          </p>
        )}

        {/* Bio */}
        {p?.bio && (
          <p className="text-sm text-muted-foreground leading-relaxed pt-1 max-w-xs mx-auto">
            {p.bio}
          </p>
        )}
      </div>

      {/* ── Interests ───────────────────────────────────────────────────────── */}
      {interests.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {interests.map((tag) => (
            <span
              key={tag}
              className="bg-[#f3f3f3] text-foreground text-xs font-semibold px-3 py-1.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-center text-muted-foreground/50 italic mb-6">
          No interests added yet — tap the pencil to add some.
        </p>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 bg-white rounded-2xl border border-border/40 shadow-sm divide-x divide-border/40 mb-4">
        {[
          { icon: BookOpen,      label: "Reviews",   count: reviewCount   },
          { icon: FileText,      label: "Resources", count: resourceCount },
          { icon: MessageCircle, label: "Questions", count: questionCount },
        ].map(({ icon: Icon, label, count }) => (
          <div key={label} className="py-4 text-center">
            <p className="text-xl font-extrabold text-foreground">{count}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Icon className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <Link
        href="/profile/edit"
        className="w-full flex items-center justify-center gap-2 bg-[#23389c] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#23389c]/20 active:scale-[0.98] transition-transform mb-3"
      >
        <Pencil className="h-4 w-4" />
        Edit Profile
      </Link>

      <SignOutForm />
    </div>
  )
}
