export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Wordmark */}
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-[#23389c] tracking-tight">
            connected
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your university hub</p>
        </div>
        {children}
      </div>
    </div>
  )
}
