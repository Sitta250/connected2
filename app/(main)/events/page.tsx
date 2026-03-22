import { CalendarDays } from "lucide-react"
import { PageShell, Placeholder } from "@/components/layout/page-shell"

export default function EventsPage() {
  return (
    <PageShell
      title="Events & News"
      subtitle="What's happening on campus"
    >
      <Placeholder
        icon={CalendarDays}
        label="Campus events & news"
        description="Upcoming events with RSVP, campus news articles, and club announcements will appear here."
      />
    </PageShell>
  )
}
