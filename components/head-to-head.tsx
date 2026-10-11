import { useState } from 'react'
import { Crown, TrendingDown, ImageOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCompact, formatMetric } from '@/lib/format'
import { isImageDataUrl } from '@/lib/image-client'
import type { RankedThumbnail, StatsResult } from '@/lib/schemas'
import { cn } from '@/lib/utils'

type Props = {
  result: StatsResult
  crops: Record<number, string>
}

function Contender({
  thumb,
  crop,
  onImageError,
  role,
  metricName,
}: {
  thumb: RankedThumbnail
  crop?: string
  onImageError: () => void
  role: 'winner' | 'loser'
  metricName: string
}) {
  const isWinner = role === 'winner'
  const hasCrop = isImageDataUrl(crop)
  return (
    <article
      className={cn(
        'flex flex-1 flex-col gap-3 rounded-lg border bg-background/50 p-3',
        isWinner ? 'border-win/60' : 'border-destructive/40',
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
        {hasCrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={crop}
            alt={`${isWinner ? 'Winner' : 'Loser'} thumbnail preview`}
            className="size-full object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="flex size-full items-center justify-center" aria-label="Thumbnail preview unavailable">
            <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <span
          className={cn(
            'absolute left-2 top-2 flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider',
            isWinner ? 'bg-win text-win-foreground' : 'bg-destructive text-foreground',
          )}
        >
          {isWinner ? <Crown className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
          {isWinner ? 'Winner' : 'Loser'}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{thumb.label}</h3>
          <p className="text-xs text-muted-foreground">{metricName}</p>
        </div>
        <p className={cn('font-mono text-2xl font-bold tabular-nums', isWinner ? 'text-win' : 'text-destructive')}>
          {formatMetric(thumb.score, metricName)}
        </p>
      </div>
    </article>
  )
}

export function HeadToHead({ result, crops }: Props) {
  const [failedCrops, setFailedCrops] = useState<Record<number, boolean>>({})
  const winner = result.ranked.find((t) => t.index === result.winnerIndex)
  const loser = result.ranked.find((t) => t.index === result.loserIndex)
  const maxScore = Math.max(...result.ranked.map((t) => t.score ?? 0), 0.0001)
  const markCropFailed = (index: number) => setFailedCrops((current) => ({ ...current, [index]: true }))

  return (
    <div className="flex flex-col gap-5">
      {winner && loser ? (
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <Contender
            thumb={winner}
            crop={failedCrops[winner.index] ? undefined : crops[winner.index]}
            onImageError={() => markCropFailed(winner.index)}
            role="winner"
            metricName={result.primaryMetricName}
          />
          <div className="flex shrink-0 flex-row items-center justify-center gap-2 md:flex-col">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">vs</span>
            {result.liftPercent != null && (
              <span className="rounded-md bg-win/15 px-2 py-1 font-mono text-sm font-bold text-win">
                +{result.liftPercent.toFixed(1)}%
              </span>
            )}
          </div>
          <Contender
            thumb={loser}
            crop={failedCrops[loser.index] ? undefined : crops[loser.index]}
            onImageError={() => markCropFailed(loser.index)}
            role="loser"
            metricName={result.primaryMetricName}
          />
        </div>
      ) : (
        <p className="rounded-md border border-border bg-background/50 p-4 text-sm leading-relaxed text-muted-foreground">
          We found {result.ranked.length} thumbnail{result.ranked.length === 1 ? '' : 's'}, but not enough comparable
          numbers to declare a winner. Try a screenshot that shows each variant&apos;s {result.primaryMetricName}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">All thumbnail variants ranked by {result.primaryMetricName}</caption>
          <thead>
            <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">#</th>
              <th scope="col" className="py-2 pr-3 font-medium">Thumbnail</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Impressions</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Plays</th>
              <th scope="col" className="w-2/5 py-2 font-medium">{result.primaryMetricName}</th>
            </tr>
          </thead>
          <tbody>
            {result.ranked.map((t) => {
              const isWinner = t.index === result.winnerIndex
              const isLoser = t.index === result.loserIndex
              const crop = failedCrops[t.index] ? undefined : crops[t.index]
              const hasCrop = isImageDataUrl(crop)
              return (
                <tr key={t.index} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-muted-foreground">{t.rank}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      {hasCrop ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={crop}
                          alt=""
                          className="h-7 w-12 shrink-0 rounded-sm object-cover"
                          onError={() => markCropFailed(t.index)}
                        />
                      ) : (
                        <span
                          className="flex h-7 w-12 shrink-0 items-center justify-center rounded-sm bg-muted"
                          aria-label="Thumbnail preview unavailable"
                        >
                          <ImageOff className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        </span>
                      )}
                      <span className="truncate font-medium text-foreground">{t.label}</span>
                      {isWinner && <Badge className="bg-win text-win-foreground">Winner</Badge>}
                      {isLoser && <Badge variant="destructive">Loser</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatCompact(t.impressions)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatCompact(t.plays)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', isWinner ? 'bg-win' : isLoser ? 'bg-destructive' : 'bg-primary')}
                          style={{ width: `${((t.score ?? 0) / maxScore) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-xs tabular-nums text-foreground">
                        {formatMetric(t.score, result.primaryMetricName)}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {result.notes && <p className="text-xs leading-relaxed text-muted-foreground">{result.notes}</p>}
    </div>
  )
}
