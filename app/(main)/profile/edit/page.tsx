import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EditProfileForm } from "@/components/features/edit-profile-form"

export default async function EditProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, bio, year_of_study, graduation_year, interests")
    .eq("id", user.id)
    .single()

  return (
    <div className="px-4 pt-12 pb-28">

      <EditProfileForm
        userId={user.id}
        initialData={{
          fullName:       data?.full_name       ?? "",
          avatarUrl:      data?.avatar_url      ?? null,
          bio:            data?.bio             ?? "",
          yearOfStudy:    data?.year_of_study   ?? "",
          graduationYear: data?.graduation_year ?? null,
          interests:      (data?.interests as string[] | null) ?? [],
        }}
      />
    </div>
  )
}
