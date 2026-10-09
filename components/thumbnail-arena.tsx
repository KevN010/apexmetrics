'use client'

import { useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { Loader2, Sparkles } from 'lucide-react'
import { BenchmarkGallery } from '@/components/benchmark-gallery'
import { FeedbackReport } from '@/components/feedback-report'
import { HeadToHead } from '@/components/head-to-head'
import { Panel } from '@/components/panel'
import { StatsDropzone } from '@/components/stats-dropzone'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson, postJson } from '@/lib/format'
import { cropFromBox, fileToCompressedDataUrl } from '@/lib/image-client'
import type { Feedback, StatsResult, TopGame } from '@/lib/schemas'

type FeedbackResponse = {
  feedback: Feedback
  benchmarks: Pick<TopGame, 'name' | 'thumbnailUrl' | 'rootPlaceId' | 'universeId' | 'playerCount'>[]
}

export function ThumbnailArena() {
  const [statsImage, setStatsImage] = useState<string | null>(null)
  const [crops, setCrops] = useState<Record<number, string>>({})
  const [genre, setGenre] = useState<string | null>(null)

  const analyze = useSWRMutation('/api/analyze-stats', postJson<StatsResult>)
  const feedback = useSWRMutation('/api/feedback', postJson<FeedbackResponse>)
  const genres = useSWR<{ genres: { name: string; count: number }[] }>('/api/top-games', getJson)
  const topGames = useSWR<{ games: TopGame[] }>(
    genre ? `/api/top-games?genre=${encodeURIComponent(genre)}` : null,
    getJson,
  )

  const result = analyze.data
  const winner = result?.ranked.find((t) => t.index === result.winnerIndex) ?? null
  const loser = result?.ranked.find((t) => t.index === result.loserIndex) ?? null

  async function handleFile(file: File) {
    const dataUrl = await fileToCompressedDataUrl(file)
    setStatsImage(dataUrl)
    setCrops({})
    feedback.reset()
    try {
      const stats = await analyze.trigger({ image: dataUrl })
      const entries = await Promise.all(
        stats.ranked.map(async (t) => [t.index, t.box ? await cropFromBox(dataUrl, t.box) : null] as const),
      )
      setCrops(Object.fromEntries(entries.filter((e): e is readonly [number, string] => e[1] != null)))
    } catch {
      // error is surfaced via analyze.error
    }
  }

  function handleReset() {
    setStatsImage(null)
    setCrops({})
    analyze.reset()
    feedback.reset()
  }

  function runFeedback() {
    if (!result || !statsImage || !genre) return
    feedback
      .trigger({
        genre,
        statsImage,
        summary: {
          primaryMetricName: result.primaryMetricName,
          winnerLabel: winner?.label ?? null,
          loserLabel: loser?.label ?? null,
          liftPercent: result.liftPercent,
          thumbnails: result.ranked.map((t) => ({
            label: t.label,
            visualDescription: t.visualDescription,
            score: t.score,
          })),
        },
      })
      .catch(() => {})
  }

  const canCompare = Boolean(result && genre && !feedback.isMutating)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel step="1" title="Your thumbnail test" className="lg:col-span-4">
          <StatsDropzone image={statsImage} loading={analyze.isMutating} onFile={handleFile} onReset={handleReset} />
        </Panel>

        <Panel
          step="2"
          title="Winner & loser"
          description={result ? `Ranked by ${result.primaryMetricName}` : undefined}
          className="lg:col-span-8"
        >
          {analyze.error ? (
            <p role="alert" className="rounded-md border border-destructive/40 p-4 text-sm leading-relaxed text-destructive">
              {analyze.error.message}
            </p>
          ) : analyze.isMutating ? (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <Skeleton className="aspect-video flex-1" />
                <Skeleton className="aspect-video flex-1" />
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          ) : result ? (
            <HeadToHead result={result} crops={crops} />
          ) : (
            <EmptyHeadToHead />
          )}
        </Panel>
      </div>

      <Panel
        step="3"
        title="Benchmark against the top 100"
        description="Pick your genre to compare with the most-played games on Roblox right now."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={genre} onValueChange={(value) => setGenre(value as string | null)}>
              <SelectTrigger className="h-9 w-full min-w-56 sm:w-auto" aria-label="Genre">
                <SelectValue placeholder={genres.isLoading ? 'Loading genres…' : 'Choose a genre'} />
              </SelectTrigger>
              <SelectContent>
                {genres.data?.genres.map((g) => (
                  <SelectItem key={g.name} value={g.name}>
                    {g.name}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{g.count}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="lg" onClick={runFeedback} disabled={!canCompare}>
              {feedback.isMutating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {feedback.isMutating ? 'Analyzing…' : 'Get AI feedback'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-8">
          {!result && genre && (
            <p className="text-sm text-muted-foreground">Upload your stats screenshot above to unlock AI feedback.</p>
          )}

          {feedback.error && (
            <p role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
              {feedback.error.message}
            </p>
          )}

          {feedback.isMutating && (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Comparing your thumbnails with the top {genre} games…
              </p>
              <Skeleton className="h-8 w-3/4" />
              <div className="grid gap-3 md:grid-cols-2">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            </div>
          )}

          {feedback.data && !feedback.isMutating && (
            <FeedbackReport
              feedback={feedback.data.feedback}
              benchmarks={feedback.data.benchmarks}
              winnerLabel={winner?.label ?? null}
              loserLabel={loser?.label ?? null}
            />
          )}

          {genre ? (
            <div className="flex flex-col gap-3">
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Top {topGames.data?.games.length ?? ''} {genre} games by live players
              </h3>
              <BenchmarkGallery games={topGames.data?.games} loading={topGames.isLoading} error={topGames.error?.message} />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Choose a genre to load live thumbnails from the Roblox charts.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}

function EmptyHeadToHead() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        {['Winner', 'Loser'].map((label) => (
          <div
            key={label}
            className="flex aspect-video flex-1 items-center justify-center rounded-lg border border-dashed border-input"
          >
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Upload a screenshot and we&apos;ll read every variant&apos;s impressions, plays and play-through rate, then crown
        the winner.
      </p>
    </div>
  )
}
