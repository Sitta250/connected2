import { ShoppingBag } from "lucide-react"
import { PageShell, Placeholder } from "@/components/layout/page-shell"

export default function MarketplacePage() {
  return (
    <PageShell
      title="Marketplace"
      subtitle="Buy and sell within your university"
    >
      <Placeholder
        icon={ShoppingBag}
        label="Campus marketplace"
        description="Browse listings from students at your university. Post textbooks, electronics, furniture and more."
      />
    </PageShell>
  )
}
