import { z } from 'zod'

export const thumbnailStatSchema = z.object({
  id: z
    .string()
    .nullable()
    .describe('Identifier shown for this thumbnail variant, or null if none is shown.'),
  label: z
    .string()
    .describe('Name or label of the thumbnail as shown in the screenshot, e.g. "Thumbnail A" or the file name.'),
  visualDescription: z
    .string()
    .describe("One sentence describing this variant's actual Roblox game-thumbnail artwork preview, never a graph or dashboard element; say the preview could not be identified if uncertain."),
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
    .describe('Set to null during metrics extraction; thumbnail image locations are resolved separately.'),
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
  verdict: z.string().describe('A punchy, visually grounded thumbnail verdict or winner-vs-loser explanation.'),
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
  competitorBlueprints: z
    .array(
      z.object({
        perspective: z
          .string()
          .min(8)
          .max(200)
          .describe('Step 1: Identify the visibly demonstrated camera perspective/angle, such as first-person POV, over-the-shoulder, isometric, cinematic wide-angle, or split-screen.'),
        focalFraming: z
          .string()
          .min(8)
          .max(250)
          .describe('Step 1: Identify the actual dominant subject/object, its placement, and estimated share of the frame; report whether it occupies 60-80% or give the best evidence-based estimate.'),
        visualHooks: z
          .array(z.string().min(3).max(120))
          .min(1)
          .max(3)
          .describe('List visible hook structures and placement/direction, such as speed lines, glow, or color splits, without copying source-game assets.'),
        secondaryStyleInfluence: z
          .string()
          .min(8)
          .max(300)
          .describe('A restrained description of the selected competitor thumbnail’s visible FX/vibe only, to influence the final image at 30%; never include its assets, world, characters, or base art style.'),
      }),
    )
    .length(1)
    .describe('One structural blueprint for the user-selected competitor thumbnail. This is analysis, not a finished image prompt.'),
  dynamicStyleProfile: z
    .object({
      characterTopology: z
        .string()
        .min(20)
        .max(600)
        .describe('Visible character and asset shapes, topology, clothing, equipment, and distinctive identity from the winning thumbnail.'),
      renderingAndShaders: z
        .string()
        .min(20)
        .max(500)
        .describe('Visible rendering style, geometry/material finish, shaders, lighting quality, and color treatment in the winning thumbnail.'),
      environmentAndTheme: z
        .string()
        .min(20)
        .max(500)
        .describe('Only the environment, setting, props, and thematic details visibly present in the winning thumbnail.'),
      composition: z
        .string()
        .min(20)
        .max(500)
        .describe('Visible camera perspective, framing, layout, and primary action/focal point to preserve in winner derivatives.'),
    })
    .describe('Dynamic style profile extracted from the supplied winning thumbnail in the context of the target game name; use it as the target identity anchor for generation.'),
  winnerLoserBreakdown: z
    .object({
      focalPointContrast: z.object({
        analysis: z.string().describe('Why the winning thumbnail draws more attention, compared with the loser.'),
        winnerHighlight: z.string().describe('The specific winner detail that attracts attention.'),
        loserHighlight: z.string().describe('The specific loser detail that weakens attention.'),
      }),
      clarityReadability: z.object({
        analysis: z.string().describe('Compare thumbnail readability and visual noise at small sizes.'),
        winnerHighlight: z.string().describe('The clearest visual strength of the winner.'),
        loserHighlight: z.string().describe('The main clutter, contrast, or framing problem in the loser.'),
      }),
      clickabilityFactors: z.object({
        analysis: z.string().describe('Explain the visual factors that make the winner more clickable.'),
        actionableInsights: z.array(z.string()).min(1).max(4),
      }),
      winnerAnnotations: z
        .array(
          z.object({
            x: z.number().min(0).max(100).describe('Horizontal location of the highlighted feature as a percentage of image width.'),
            y: z.number().min(0).max(100).describe('Vertical location of the highlighted feature as a percentage of image height.'),
            label: z.string().max(80),
            insight: z.string().max(300),
          }),
        )
        .min(1)
        .max(3),
      loserAnnotations: z
        .array(
          z.object({
            x: z.number().min(0).max(100).describe('Horizontal location of the highlighted feature as a percentage of image width.'),
            y: z.number().min(0).max(100).describe('Vertical location of the highlighted feature as a percentage of image height.'),
            label: z.string().max(80),
            insight: z.string().max(300),
          }),
        )
        .min(1)
        .max(3),
    })
    .nullable()
    .describe('In-depth visual comparison. Return null when no loser thumbnail was provided.'),
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
