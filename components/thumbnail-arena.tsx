'use client'

import { useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { Loader2, Sparkles } from 'lucide-react'
import { BenchmarkGallery } from '@/components/benchmark-gallery'
import { ConceptGallery } from '@/components/concept-gallery'
import { FeedbackReport } from '@/components/feedback-report'
import { HeadToHead } from '@/components/head-to-head'
import { ImageReferenceInput } from '@/components/image-reference-input'
import { Panel } from '@/components/panel'
import { StatsDropzone } from '@/components/stats-dropzone'
import { WinnerLoserBreakdown } from '@/components/winner-loser-breakdown'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson, postJson } from '@/lib/format'
import { cropFromBox, fileToCompressedDataUrl } from '@/lib/image-client'
import type { Feedback, StatsResult, TopGame } from '@/lib/schemas'

type GeneratedConcept = {
  id: string
  category: 'derivative' | 'competitor'
  label: string
  prompt: string
  imageDataUrl: string
  inspiredBy?: string
}

type FeedbackResponse = {
  feedback: Feedback
  concepts: GeneratedConcept[]
  benchmarks: Pick<TopGame, 'name' | 'thumbnailUrl' | 'rootPlaceId' | 'universeId' | 'playerCount'>[]
}

export function ThumbnailArena() {
  const [statsImage, setStatsImage] = useState<string | null>(null)
  const [crops, setCrops] = useState<Record<number, string>>({})
  const [cropError, setCropError] = useState<string | null>(null)
  const [genre, setGenre] = useState<string | null>(null)
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('')
  const [gameName, setGameName] = useState('')
  const [winningThumbnailOverride, setWinningThumbnailOverride] = useState<string | null>(null)
  const [losingThumbnailOverride, setLosingThumbnailOverride] = useState<string | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [referenceLoading, setReferenceLoading] = useState(false)

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
  const winningThumbnail = winningThumbnailOverride ?? (winner ? crops[winner.index] ?? null : null)
  const losingThumbnail = losingThumbnailOverride ?? (loser ? crops[loser.index] ?? null : null)
  const competitorOptions =
    topGames.data?.games
      .map((game, index) => ({ game, rank: index + 1 }))
      .filter(({ game }) => game.thumbnailUrl) ?? []
  const selectedCompetitorOption =
    competitorOptions.find(({ game }) => String(game.universeId) === selectedCompetitorId) ?? competitorOptions[0]
  const selectedCompetitor = selectedCompetitorOption?.game

  async function handleFile(file: File) {
    const dataUrl = await fileToCompressedDataUrl(file)
    setStatsImage(dataUrl)
    setCrops({})
    setCropError(null)
    feedback.reset()
    let stats: StatsResult
    try {
      stats = await analyze.trigger({ image: dataUrl })
    } catch {
      return
    }

    try {
      const entries = await Promise.all(
        stats.ranked.map(async (t) => [t.index, t.box ? await cropFromBox(dataUrl, t.box) : null] as const),
      )
      const availableCrops = entries.filter((e): e is readonly [number, string] => e[1] != null)
      setCrops(Object.fromEntries(availableCrops))
      if (availableCrops.length !== stats.ranked.length) {
        setCropError(
          `Could not locate screenshot previews for ${stats.ranked.length - availableCrops.length} thumbnail variant(s). Try a screenshot where each thumbnail image is clearly visible.`,
        )
      }
    } catch (error) {
      console.error('[thumbnail-arena] thumbnail crop failed', error)
      setCropError('We read the metrics, but could not extract the thumbnail previews. Please upload the screenshot again.')
    }
  }

  function handleReset() {
    setStatsImage(null)
    setCrops({})
    setCropError(null)
    analyze.reset()
    feedback.reset()
  }

  async function handleReferenceFile(file: File, role: 'winner' | 'loser') {
    if (!file || !file.type.startsWith('image/')) return
    setReferenceLoading(true)
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      if (role === 'winner') setWinningThumbnailOverride(dataUrl)
      else setLosingThumbnailOverride(dataUrl)
      setReferenceError(null)
      feedback.reset()
    } catch (error) {
      console.error(`[thumbnail-arena] ${role} thumbnail upload failed`, error)
      setReferenceError(`Could not load that ${role} thumbnail. Please choose a PNG, JPEG, or WebP image.`)
    } finally {
      setReferenceLoading(false)
    }
  }

  function runFeedback() {
    if (!genre || !gameName.trim() || !winningThumbnail || !selectedCompetitor) return
    feedback
      .trigger({
        genre,
        gameName: gameName.trim(),
        competitorId: selectedCompetitor.universeId,
        winningThumbnail,
        loserThumbnail: losingThumbnail ?? undefined,
        summary: result && !winningThumbnailOverride
          ? {
              primaryMetricName: result.primaryMetricName,
              winnerLabel: winner?.label ?? null,
              loserLabel: loser?.label ?? null,
              liftPercent: result.liftPercent,
              thumbnails: result.ranked.map((t) => ({
                label: t.label,
                visualDescription: t.visualDescription,
                score: t.score,
              })),
            }
          : undefined,
      })
      .catch(() => {})
  }

  const canCompare = Boolean(
    genre &&
      gameName.trim() &&
      winningThumbnail &&
      selectedCompetitor &&
      !topGames.isLoading &&
      !referenceLoading &&
      !feedback.isMutating,
  )

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
            <>
              {cropError && (
                <p role="alert" className="mb-4 rounded-md border border-destructive/40 p-4 text-sm text-destructive">
                  {cropError}
                </p>
              )}
              <HeadToHead result={result} crops={crops} />
            </>
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
            <Select
              value={genre}
              onValueChange={(value) => {
                setGenre(value as string | null)
                setSelectedCompetitorId('')
                feedback.reset()
              }}
            >
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
              {feedback.isMutating ? 'Analyzing & generating…' : 'Get feedback & thumbnail'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-background/40 p-4">
            <div>
              <label htmlFor="target-game-name" className="text-sm font-semibold text-foreground">
                Target game name
              </label>
              <input
                id="target-game-name"
                type="text"
                maxLength={120}
                placeholder="e.g. Entrenched"
                value={gameName}
                onChange={(event) => {
                  setGameName(event.target.value)
                  feedback.reset()
                }}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(12rem,16rem)] sm:items-end">
              <div>
                <label htmlFor="competitor-choice" className="text-sm font-semibold text-foreground">
                  Competitor inspiration
                </label>
                <Select
                  value={selectedCompetitor ? String(selectedCompetitor.universeId) : null}
                  onValueChange={(value) => {
                    setSelectedCompetitorId(value as string)
                    feedback.reset()
                  }}
                  disabled={!genre || topGames.isLoading || competitorOptions.length === 0 || feedback.isMutating}
                >
                  <SelectTrigger id="competitor-choice" className="mt-2 w-full" aria-label="Competitor inspiration">
                    <SelectValue placeholder={topGames.isLoading ? 'Loading top games…' : 'Choose a competitor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {competitorOptions.map(({ game, rank }) => (
                      <SelectItem key={game.universeId} value={String(game.universeId)}>
                        #{rank} {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCompetitor?.thumbnailUrl && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedCompetitor.thumbnailUrl}
                    alt={`${selectedCompetitor.name} competitor thumbnail`}
                    className="aspect-video w-24 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{selectedCompetitor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      #{selectedCompetitorOption?.rank} by live players
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ImageReferenceInput
                label="Winning thumbnail"
                image={winningThumbnail}
                description={
                  winningThumbnailOverride
                    ? 'Using your Step 3 upload.'
                    : winner && winningThumbnail
                      ? `Using the Step 2 winner: ${winner.label}.`
                      : 'Used as the generation reference and winner for direct visual feedback.'
                }
                disabled={feedback.isMutating || referenceLoading}
                onFile={(file) => void handleReferenceFile(file, 'winner')}
              />
              <ImageReferenceInput
                label="Losing thumbnail (optional)"
                image={losingThumbnail}
                description={
                  losingThumbnailOverride
                    ? 'Using your Step 3 upload for comparison.'
                    : loser && losingThumbnail
                      ? `Using the Step 2 loser: ${loser.label}.`
                      : 'Add a loser image to enable annotated winner-vs-loser analysis.'
                }
                disabled={feedback.isMutating || referenceLoading}
                onFile={(file) => void handleReferenceFile(file, 'loser')}
              />
            </div>
            {referenceError && (
              <p role="alert" className="text-sm text-destructive">
                {referenceError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Review before generating: <strong className="font-medium text-foreground">{gameName.trim() || 'Game name needed'}</strong>
              {' · '}
              <strong className="font-medium text-foreground">
                {winningThumbnail ? (winningThumbnailOverride ? 'Uploaded winning image' : winner?.label ?? 'Winning image') : 'Winning image needed'}
              </strong>
              {losingThumbnail && (
                <>
                  {' · '}
                  <strong className="font-medium text-foreground">
                    {losingThumbnailOverride ? 'Uploaded losing image' : loser?.label ?? 'Losing image'}
                  </strong>
                </>
              )}
            </p>
          </section>

          {feedback.error && (
            <p role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
              {feedback.error.message}
            </p>
          )}

          {feedback.isMutating && (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Analyzing {gameName} against the top {genre} games and generating six concepts…
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
          {feedback.data && !feedback.isMutating && (
            <WinnerLoserBreakdown
              breakdown={feedback.data.feedback.winnerLoserBreakdown}
              winnerThumbnail={winningThumbnail}
              loserThumbnail={losingThumbnail}
            />
          )}
          {feedback.data && !feedback.isMutating && (
            <ConceptGallery concepts={feedback.data.concepts} gameName={gameName.trim()} />
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
        Optionally upload a stats screenshot in Step 1 to rank variants. Or skip it and add a winning thumbnail directly
        in Step 3 to get feedback and generate concepts.
      </p>
    </div>
  )
}
