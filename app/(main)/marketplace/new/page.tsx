import Link from "next/link"
import { ChevronLeft, Plus } from "lucide-react"
import { Placeholder } from "@/components/layout/page-shell"

export default function NewListingPage() {
  return (
    <div className="px-4 pt-12 pb-4">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Marketplace
      </Link>

      <h1 className="font-display text-xl font-bold mb-6">Create listing</h1>

      <Placeholder
        icon={Plus}
        label="New listing form"
        description="Title, description, price, condition, category, and image upload. Coming soon."
      />
    </div>
  )
}
