import type { StatsExtraction, StatsResult, ThumbnailStat } from './schemas'

function scoreOf(t: ThumbnailStat): number | null {
  if (t.primaryMetricValue != null) return t.primaryMetricValue
  if (t.playThroughRate != null) return t.playThroughRate
  if (t.plays != null && t.impressions) return (t.plays / t.impressions) * 100
  return null
}

export function rankThumbnails(extraction: StatsExtraction): StatsResult {
  const withScores = extraction.thumbnails.map((t, index) => ({ ...t, index, score: scoreOf(t) }))
  const direction = extraction.higherIsBetter ? -1 : 1

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
      liftPercent = extraction.higherIsBetter ? raw : -raw
    }
  } else if (ranked.length >= 2) {
    const marked = ranked.find((t) => t.markedAsWinner)
    if (marked) {
      winnerIndex = marked.index
      loserIndex = ranked.find((t) => t.index !== marked.index)!.index
    }
  }

  return { ...extraction, ranked, winnerIndex, loserIndex, liftPercent }
}
