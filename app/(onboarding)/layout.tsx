// The onboarding group has its own minimal layout — no sidebar, no bottom nav.
// Auth is still enforced: middleware redirects unauthenticated users to /login.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
