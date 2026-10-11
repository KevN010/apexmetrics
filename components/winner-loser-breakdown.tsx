import type { Feedback } from '@/lib/schemas'

type Breakdown = NonNullable<Feedback['winnerLoserBreakdown']>
type Annotation = Breakdown['winnerAnnotations'][number]

type Props = {
  breakdown: Feedback['winnerLoserBreakdown']
  winnerThumbnail: string | null
  loserThumbnail: string | null
}

function AnnotatedThumbnail({
  title,
  image,
  annotations,
  tone,
}: {
  title: string
  image: string
  annotations: Annotation[]
  tone: 'winner' | 'loser'
}) {
  const markerStyle =
    tone === 'winner'
      ? 'bg-win text-win-foreground ring-win/30'
      : 'bg-destructive text-destructive-foreground ring-destructive/30'

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={`${title} with visual analysis markers`} className="size-full object-cover" />
        {annotations.map((annotation, index) => (
          <span
            key={`${annotation.label}-${index}`}
            className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold ring-4 ${markerStyle}`}
            style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
            aria-label={`${index + 1}: ${annotation.label}`}
          >
            {index + 1}
          </span>
        ))}
      </div>
      <ol className="flex flex-col gap-2">
        {annotations.map((annotation, index) => (
          <li key={`${annotation.label}-${index}`} className="flex gap-2 text-sm leading-relaxed">
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${markerStyle}`}>
              {index + 1}
            </span>
            <span>
              <strong className="font-semibold text-foreground">{annotation.label}: </strong>
              <span className="text-muted-foreground">{annotation.insight}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function WinnerLoserBreakdown({ breakdown, winnerThumbnail, loserThumbnail }: Props) {
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-background/40 p-4" aria-labelledby="winner-loser-breakdown">
      <div>
        <h3 id="winner-loser-breakdown" className="font-mono text-xs font-semibold uppercase tracking-widest text-foreground">
          In-Depth Winner vs. Loser Breakdown
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Side-by-side visual evidence, focal-point callouts, and actionable clickability insights.
        </p>
      </div>

      {breakdown && winnerThumbnail && loserThumbnail ? (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <AnnotatedThumbnail title="Winner" image={winnerThumbnail} annotations={breakdown.winnerAnnotations} tone="winner" />
            <AnnotatedThumbnail title="Loser" image={loserThumbnail} annotations={breakdown.loserAnnotations} tone="loser" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <article className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3">
              <h4 className="text-sm font-semibold text-foreground">Focal Point &amp; Contrast</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">{breakdown.focalPointContrast.analysis}</p>
              <p className="text-sm leading-relaxed text-win">
                <strong>Winner: </strong>{breakdown.focalPointContrast.winnerHighlight}
              </p>
              <p className="text-sm leading-relaxed text-destructive">
                <strong>Loser: </strong>{breakdown.focalPointContrast.loserHighlight}
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3">
              <h4 className="text-sm font-semibold text-foreground">Clarity &amp; Readability</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">{breakdown.clarityReadability.analysis}</p>
              <p className="text-sm leading-relaxed text-win">
                <strong>Winner: </strong>{breakdown.clarityReadability.winnerHighlight}
              </p>
              <p className="text-sm leading-relaxed text-destructive">
                <strong>Loser: </strong>{breakdown.clarityReadability.loserHighlight}
              </p>
            </article>
          </div>

          <article className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3">
            <h4 className="text-sm font-semibold text-foreground">Clickability Factors</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{breakdown.clickabilityFactors.analysis}</p>
            <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-foreground">
              {breakdown.clickabilityFactors.actionableInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </article>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-input p-4 text-sm leading-relaxed text-muted-foreground">
          Upload a losing thumbnail above (or analyze a Step 1 screenshot that includes a loser) and run the analysis again to see annotated visual differences and a full comparison.
        </p>
      )}
    </section>
  )
}
