import { z } from 'zod'

export const thumbnailStatSchema = z.object({
  label: z
    .string()
    .describe('Name or label of the thumbnail as shown in the screenshot, e.g. "Thumbnail A" or the file name.'),
  visualDescription: z
    .string()
    .describe('One sentence describing what the thumbnail image shows, based on the preview in the screenshot.'),
  impressions: z.number().nullable().describe('Number of impressions, or null if not shown.'),
  plays: z.number().nullable().describe('Number of plays / clicks, or null if not shown.'),
  playThroughRate: z
    .number()
    .nullable()
    .describe('Play-through rate or click-through rate as a percentage number (e.g. 4.2 for 4.2%), or null.'),
  primaryMetricValue: z
    .number()
    .nullable()
    .describe('Value of the primary comparison metric for this thumbnail, as a plain number. Percentages as e.g. 4.2.'),
  otherMetrics: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .describe('Any other metrics shown for this thumbnail (e.g. avg session time, confidence, lift).'),
  markedAsWinner: z.boolean().describe('True if the screenshot itself explicitly labels this thumbnail as the winner.'),
  box: z
    .array(z.number())
    .nullable()
    .describe(
      'Bounding box of the thumbnail preview image inside the screenshot as [ymin, xmin, ymax, xmax] normalized to 0-1000. Null if no preview image is visible.',
    ),
})

export const statsExtractionSchema = z.object({
  isThumbnailStats: z
    .boolean()
    .describe('True if the image is a screenshot of Roblox thumbnail / experience statistics or an A/B test.'),
  experimentName: z.string().nullable(),
  primaryMetricName: z
    .string()
    .describe('The metric that best decides the winner, e.g. "Qualified Play-Through Rate" or "Click-Through Rate".'),
  higherIsBetter: z.boolean(),
  thumbnails: z.array(thumbnailStatSchema),
  notes: z
    .string()
    .nullable()
    .describe('Short note about data quality, sample size, or statistical confidence if visible.'),
})

export type ThumbnailStat = z.infer<typeof thumbnailStatSchema>
export type StatsExtraction = z.infer<typeof statsExtractionSchema>

export type RankedThumbnail = ThumbnailStat & {
  index: number
  score: number | null
  rank: number
}

export type StatsResult = StatsExtraction & {
  ranked: RankedThumbnail[]
  winnerIndex: number | null
  loserIndex: number | null
  liftPercent: number | null
}

const scoreSchema = z.number().min(0).max(10)

export const feedbackSchema = z.object({
  verdict: z.string().describe('One punchy sentence explaining why the winner beat the loser.'),
  thumbnailScores: z.array(
    z.object({
      label: z.string(),
      overall: z.number().min(0).max(100),
      clarity: scoreSchema.describe('Readability at small sizes on mobile.'),
      color: scoreSchema.describe('Color contrast, saturation and pop against the Roblox UI.'),
      character: scoreSchema.describe('Use of characters / faces / emotion.'),
      text: scoreSchema.describe('Effectiveness of on-image text, or restraint when absent.'),
      genreFit: scoreSchema.describe('How well it matches what top games in the selected genre do.'),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
    }),
  ),
  differences: z
    .array(
      z.object({
        aspect: z.string().describe('e.g. "Focal point", "Color palette", "Text overlay".'),
        winner: z.string(),
        loser: z.string(),
        impact: z.enum(['high', 'medium', 'low']),
      }),
    )
    .describe('Concrete visual differences between the winning and losing thumbnail.'),
  genreTrends: z
    .array(
      z.object({
        trend: z.string(),
        prevalence: z.string().describe('e.g. "9 of 12 top games".'),
        yourStatus: z.enum(['matches', 'partial', 'missing']),
      }),
    )
    .describe('Patterns seen across the top games in the genre and whether the winning thumbnail follows them.'),
  recommendations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  closestBenchmarks: z
    .array(z.object({ gameName: z.string(), why: z.string() }))
    .describe('Up to 3 top games whose thumbnails are worth studying, using their exact names.'),
})

export type Feedback = z.infer<typeof feedbackSchema>

export type TopGame = {
  universeId: number
  rootPlaceId: number
  name: string
  playerCount: number
  upVotes: number
  downVotes: number
  genre: string
  thumbnailUrl: string | null
}
