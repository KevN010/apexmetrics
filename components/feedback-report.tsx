import { Check, CircleDashed, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Feedback, TopGame } from '@/lib/schemas'
import { cn } from '@/lib/utils'

type Props = {
  feedback: Feedback
  benchmarks: Pick<TopGame, 'name' | 'thumbnailUrl' | 'rootPlaceId'>[]
  winnerLabel: string | null
  loserLabel: string | null
}

const impactStyles = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-win/15 text-win',
  low: 'bg-muted text-muted-foreground',
} as const

const scoreKeys = [
  ['clarity', 'Clarity'],
  ['color', 'Color'],
  ['character', 'Character'],
  ['text', 'Text'],
  ['genreFit', 'Genre fit'],
] as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{children}</h3>
}

export function FeedbackReport({ feedback, benchmarks, winnerLabel, loserLabel }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-balance text-xl font-semibold leading-snug text-foreground md:text-2xl">{feedback.verdict}</p>

      {feedback.thumbnailScores.length > 0 && <section className="flex flex-col gap-3" aria-labelledby="scores-heading">
        <SectionTitle>
          <span id="scores-heading">Scorecard</span>
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {feedback.thumbnailScores.map((t) => {
            const role = t.label === winnerLabel ? 'winner' : t.label === loserLabel ? 'loser' : null
            return (
              <article key={t.label} className="flex flex-col gap-4 rounded-lg border border-border bg-background/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="truncate font-semibold text-foreground">{t.label}</h4>
                    {role === 'winner' && <Badge className="bg-win text-win-foreground">Winner</Badge>}
                    {role === 'loser' && <Badge variant="destructive">Loser</Badge>}
                  </div>
                  <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
                    {Math.round(t.overall)}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                </div>
                <dl className="grid grid-cols-5 gap-2">
                  {scoreKeys.map(([key, label]) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="flex flex-col gap-1">
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{t[key]}</span>
                        <span className="h-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${t[key] * 10}%` }} />
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <ul className="flex flex-col gap-1.5">
                    {t.strengths.map((s) => (
                      <li key={s} className="flex gap-2 leading-relaxed text-foreground">
                        <Check className="mt-1 size-3.5 shrink-0 text-win" aria-label="Strength" />
                        {s}
                      </li>
                    ))}
                  </ul>
                  <ul className="flex flex-col gap-1.5">
                    {t.weaknesses.map((w) => (
                      <li key={w} className="flex gap-2 leading-relaxed text-muted-foreground">
                        <X className="mt-1 size-3.5 shrink-0 text-destructive" aria-label="Weakness" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </div>
      </section>}

      {feedback.differences.length > 0 && <section className="flex flex-col gap-3">
        <SectionTitle>What separated the winner from the loser</SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-background/50">
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="p-3 font-medium">Aspect</th>
                <th scope="col" className="p-3 font-medium text-win">Winner</th>
                <th scope="col" className="p-3 font-medium text-destructive">Loser</th>
                <th scope="col" className="p-3 font-medium">Impact</th>
              </tr>
            </thead>
            <tbody>
              {feedback.differences.map((d) => (
                <tr key={d.aspect} className="border-t border-border align-top">
                  <th scope="row" className="p-3 text-left font-semibold text-foreground">{d.aspect}</th>
                  <td className="p-3 leading-relaxed text-foreground">{d.winner}</td>
                  <td className="p-3 leading-relaxed text-muted-foreground">{d.loser}</td>
                  <td className="p-3">
                    <span className={cn('rounded px-2 py-0.5 font-mono text-[11px] uppercase', impactStyles[d.impact])}>
                      {d.impact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>}

      {(feedback.genreTrends.length > 0 || feedback.recommendations.length > 0) && <div className="grid gap-8 lg:grid-cols-2">
        {feedback.genreTrends.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Genre patterns vs. your winner</SectionTitle>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {feedback.genreTrends.map((t) => (
              <li key={t.trend} className="flex items-start gap-3 p-3">
                {t.yourStatus === 'matches' ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-win" aria-label="You match this" />
                ) : t.yourStatus === 'partial' ? (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Partially matching" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Missing" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm leading-relaxed text-foreground">{t.trend}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{t.prevalence}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        )}

        {feedback.recommendations.length > 0 && <section className="flex flex-col gap-3">
          <SectionTitle>Next steps</SectionTitle>
          <ol className="flex flex-col gap-2">
            {feedback.recommendations.map((r) => (
              <li key={r.title} className="flex flex-col gap-1 rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <span className={cn('rounded px-2 py-0.5 font-mono text-[11px] uppercase', impactStyles[r.priority])}>
                    {r.priority}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ol>
        </section>}
      </div>}

      {feedback.closestBenchmarks.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Study these</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {feedback.closestBenchmarks.map((b) => {
              const match = benchmarks.find((g) => g.name === b.gameName)
              return (
                <article key={b.gameName} className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
                  {match?.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={match.thumbnailUrl} alt={`${b.gameName} thumbnail`} className="aspect-video w-full rounded-md object-cover" />
                  )}
                  <h4 className="font-semibold text-foreground">{b.gameName}</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{b.why}</p>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
