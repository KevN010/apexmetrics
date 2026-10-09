import { cn } from '@/lib/utils'

type Props = {
  step: string
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Panel({ step, title, description, actions, className, children }: Props) {
  return (
    <section className={cn('flex flex-col gap-5 rounded-xl border border-border bg-card p-5 md:p-6', className)}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 rotate-12 items-center justify-center rounded-sm bg-primary font-mono text-xs font-bold text-primary-foreground">
            <span className="-rotate-12">{step}</span>
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold leading-tight text-foreground">{title}</h2>
            {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}
