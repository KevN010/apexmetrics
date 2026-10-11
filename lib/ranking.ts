import type { StatsExtraction, StatsResult, ThumbnailStat } from './schemas'

function scoreOf(t: ThumbnailStat, isQualifiedPlayThroughRate: boolean): number | null {
  if (isQualifiedPlayThroughRate) return t.playThroughRate ?? t.primaryMetricValue
  if (t.primaryMetricValue != null) return t.primaryMetricValue
  if (t.playThroughRate != null) return t.playThroughRate
  if (t.plays != null && t.impressions) return (t.plays / t.impressions) * 100
  return null
}

function isTotalRow(t: ThumbnailStat): boolean {
  return [t.id, t.label].some((value) => value?.trim().toLowerCase() === 'total')
}

export function rankThumbnails(extraction: StatsExtraction): StatsResult {
  const thumbnails = extraction.thumbnails.filter((t) => !isTotalRow(t))
  const isQualifiedPlayThroughRate = /qualified\s+play[\s-]*through\s+rate/i.test(extraction.primaryMetricName)
  const higherIsBetter = isQualifiedPlayThroughRate || extraction.higherIsBetter
  const withScores = thumbnails.map((t, index) => ({
    ...t,
    index,
    score: scoreOf(t, isQualifiedPlayThroughRate),
  }))
  const direction = higherIsBetter ? -1 : 1

  const sorted = [...withScores].sort((a, b) => {
    if (a.score == null && b.score == null) return Number(b.markedAsWinner) - Number(a.markedAsWinner)
    if (a.score == null) return 1
    if (b.score == null) return -1
    return (a.score - b.score) * direction
  })

  const ranked = sorted.map((t, i) => ({ ...t, rank: i + 1 }))
  const scored = ranked.filter((t) => t.score != null)

  let winnerIndex: number | null = null
  let loserIndex: number | null = null
  let liftPercent: number | null = null

  if (scored.length >= 2) {
    const winner = scored[0]
    const loser = scored[scored.length - 1]
    winnerIndex = winner.index
    loserIndex = loser.index
    if (loser.score) {
      const raw = ((winner.score! - loser.score) / Math.abs(loser.score)) * 100
      liftPercent = higherIsBetter ? raw : -raw
    }
  } else if (ranked.length >= 2) {
    const marked = ranked.find((t) => t.markedAsWinner)
    if (marked) {
      winnerIndex = marked.index
      loserIndex = ranked.find((t) => t.index !== marked.index)!.index
    }
  }

  return { ...extraction, thumbnails, ranked, winnerIndex, loserIndex, liftPercent }
}
