import Link from "next/link"
import { ChevronLeft, Users } from "lucide-react"
import { Placeholder } from "@/components/layout/page-shell"

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="pb-4">
      {/* Cover strip */}
      <div className="h-32 gradient-primary relative">
        <Link
          href="/clubs"
          className="absolute top-12 left-4 w-8 h-8 glass rounded-full flex items-center justify-center"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </Link>
      </div>

      {/* Club identity */}
      <div className="px-4 -mt-7 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white border-4 border-white shadow-sm flex items-center justify-center">
          <Users className="h-6 w-6 text-[#23389c]" />
        </div>
        <h1 className="font-display text-xl font-bold mt-3">Club page</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">id: {id}</p>
      </div>

      <div className="px-4">
        <Placeholder
          icon={Users}
          label="Club detail"
          description="Club info, member list, discussion forum and events will appear here."
        />
      </div>
    </div>
  )
}
