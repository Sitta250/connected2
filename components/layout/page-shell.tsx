import { cn } from "@/lib/utils"

interface PageShellProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Standard page header + content wrapper used across all main screens. */
export function PageShell({
  title,
  subtitle,
  action,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn("px-4 pt-12 pb-4", className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

interface PlaceholderProps {
  icon: React.ElementType
  label: string
  description: string
}

/** Empty-state block used on stub pages until the feature is implemented. */
export function Placeholder({ icon: Icon, label, description }: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#23389c]/10 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-[#23389c]" />
      </div>
      <p className="font-display font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">
        {description}
      </p>
    </div>
  )
}
