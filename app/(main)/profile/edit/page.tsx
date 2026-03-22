import Link from "next/link"
import { ChevronLeft, UserCircle } from "lucide-react"
import { Placeholder } from "@/components/layout/page-shell"

export default function EditProfilePage() {
  return (
    <div className="px-4 pt-12 pb-4">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Profile
      </Link>

      <h1 className="font-display text-xl font-bold mb-6">Edit Profile</h1>

      <Placeholder
        icon={UserCircle}
        label="Profile editor"
        description="Update your name, major, year, bio and avatar photo. Coming soon."
      />
    </div>
  )
}
