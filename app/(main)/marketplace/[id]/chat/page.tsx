import Link from "next/link"
import { ChevronLeft, MessageCircle } from "lucide-react"
import { Placeholder } from "@/components/layout/page-shell"

export default async function ListingChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="px-4 pt-12 pb-4">
      <Link
        href={`/marketplace/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Listing
      </Link>

      <h1 className="font-display text-xl font-bold mb-1">Chat</h1>
      <p className="text-xs text-muted-foreground font-mono mb-6">listing: {id}</p>

      <Placeholder
        icon={MessageCircle}
        label="Realtime chat"
        description="Buyer–seller messaging powered by Supabase Realtime. Coming soon."
      />
    </div>
  )
}
