import { Users } from "lucide-react"
import { PageShell, Placeholder } from "@/components/layout/page-shell"

export default function ClubsPage() {
  return (
    <PageShell
      title="Clubs"
      subtitle="Find your community on campus"
    >
      <Placeholder
        icon={Users}
        label="Club directory"
        description="Browse and join clubs, participate in discussion forums, and stay up to date with club events."
      />
    </PageShell>
  )
}
