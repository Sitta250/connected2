import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GraduationCap, Pencil, ChevronRight } from "lucide-react"
import { getInitials } from "@/lib/utils"
import { SignOutForm } from "@/components/features/sign-out-form"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*, universities(name)")
    .eq("id", user.id)
    .single()

  const profile = profileData as {
    full_name: string
    avatar_url: string | null
    bio: string | null
    major: string | null
    year: string | null
    university_email: string
    universities: { name: string } | null
  } | null

  const YEAR_LABEL: Record<string, string> = {
    freshman: "Freshman", sophomore: "Sophomore",
    junior: "Junior", senior: "Senior", graduate: "Graduate",
  }

  return (
    <div className="px-4 pt-12 pb-8 space-y-6">
      {/* Profile card */}
      <div className="bg-card rounded-3xl p-6 text-center space-y-4">
        <Avatar className="h-20 w-20 mx-auto">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl font-bold bg-[#23389c] text-white">
            {getInitials(profile?.full_name ?? "?")}
          </AvatarFallback>
        </Avatar>

        <div>
          <h1 className="font-display text-xl font-bold">{profile?.full_name ?? "Student"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.university_email}</p>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          {profile?.year && (
            <Badge className="bg-[#23389c]/10 text-[#23389c] hover:bg-[#23389c]/10">
              {YEAR_LABEL[profile.year] ?? profile.year}
            </Badge>
          )}
          {profile?.major && <Badge variant="secondary">{profile.major}</Badge>}
        </div>

        {profile?.bio && (
          <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
        )}

        {profile?.universities?.name && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            {profile.universities.name}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-card rounded-2xl overflow-hidden">
        <Link
          href="/profile/edit"
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#f3f3f3] transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-[#23389c]/10 flex items-center justify-center">
            <Pencil className="h-4 w-4 text-[#23389c]" />
          </div>
          <span className="flex-1 text-sm font-medium">Edit Profile</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <SignOutForm />
    </div>
  )
}
