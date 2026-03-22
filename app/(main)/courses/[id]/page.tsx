import Link from "next/link"
import { ChevronLeft, BookOpen } from "lucide-react"
import { Placeholder } from "@/components/layout/page-shell"

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="px-4 pt-12 pb-4">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Courses
      </Link>

      <div className="mb-2">
        <span className="text-xs font-bold text-[#23389c] bg-[#23389c]/10 px-2 py-0.5 rounded-lg">
          Course
        </span>
      </div>
      <h1 className="font-display text-xl font-bold mb-1">Course detail</h1>
      <p className="text-xs text-muted-foreground font-mono mb-6">id: {id}</p>

      <Placeholder
        icon={BookOpen}
        label="Reviews, Q&A, Resources"
        description="Full course page with tabbed reviews, Q&A thread and shared notes coming soon."
      />
    </div>
  )
}
