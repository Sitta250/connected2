import { BookOpen } from "lucide-react"
import { PageShell, Placeholder } from "@/components/layout/page-shell"

export default function CoursesPage() {
  return (
    <PageShell
      title="Courses"
      subtitle="Find courses, read reviews, ask questions"
    >
      <Placeholder
        icon={BookOpen}
        label="Course explorer"
        description="Search your university's course catalogue, read peer reviews, get answers, and download shared resources."
      />
    </PageShell>
  )
}
