import Link from "next/link"
import { ChevronLeft, ShoppingBag } from "lucide-react"
import { Placeholder } from "@/components/layout/page-shell"

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="px-4 pt-12 pb-4">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Marketplace
      </Link>

      <h1 className="font-display text-xl font-bold mb-1">Listing detail</h1>
      <p className="text-xs text-muted-foreground font-mono mb-6">id: {id}</p>

      <Placeholder
        icon={ShoppingBag}
        label="Listing page"
        description="Full listing with images, seller info, price and a message button will appear here."
      />
    </div>
  )
}
