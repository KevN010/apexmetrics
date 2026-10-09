import { generateText, Output } from 'ai'
import { visionModel } from '@/lib/ai-model'
import { z } from 'zod'
import { aiErrorResponse } from '@/lib/ai-error'
import { dataUrlToBytes, imageDataUrlSchema } from '@/lib/data-url'
import { getTopGames } from '@/lib/roblox'
import { feedbackSchema } from '@/lib/schemas'

export const maxDuration = 120

const BENCHMARK_COUNT = 12

const bodySchema = z.object({
  genre: z.string().min(1).max(60),
  statsImage: imageDataUrlSchema,
  summary: z.object({
    primaryMetricName: z.string().max(120),
    winnerLabel: z.string().max(120).nullable(),
    loserLabel: z.string().max(120).nullable(),
    liftPercent: z.number().nullable(),
    thumbnails: z
      .array(
        z.object({
          label: z.string().max(120),
          visualDescription: z.string().max(400),
          score: z.number().nullable(),
        }),
      )
      .max(10),
  }),
})

async function loadImage(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request.' }, { status: 400 })

  const { genre, statsImage, summary } = parsed.data
  const topGames = (await getTopGames(genre, BENCHMARK_COUNT * 2))
    .filter((g) => g.thumbnailUrl)
    .slice(0, BENCHMARK_COUNT)

  if (topGames.length === 0) {
    return Response.json({ error: `No benchmark games found for ${genre}.` }, { status: 404 })
  }

  const benchmarkImages = await Promise.all(topGames.map((g) => loadImage(g.thumbnailUrl!)))
  const stats = dataUrlToBytes(statsImage)

  const benchmarkParts = topGames.flatMap((game, i) => {
    const image = benchmarkImages[i]
    if (!image) return []
    return [
      { type: 'text' as const, text: `Top ${genre} game #${i + 1}: "${game.name}" (${game.playerCount.toLocaleString()} players now)` },
      { type: 'file' as const, mediaType: 'image/jpeg', data: image },
    ]
  })

  const thumbnailSummary = summary.thumbnails
    .map((t) => `- ${t.label}: ${t.visualDescription} (${summary.primaryMetricName}: ${t.score ?? 'n/a'})`)
    .join('\n')

  try {
    const { output } = await generateText({
      model: visionModel,
      maxRetries: 4,
      system: `You are a senior Roblox thumbnail strategist who has optimized thumbnails for front-page games.
Give specific, visual, actionable feedback that references what is actually in the images. Avoid generic advice.
Score every thumbnail variant from the developer's test. Base genre trends only on the benchmark images provided and cite counts (e.g. "8 of 12").`,
      output: Output.object({ schema: feedbackSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Genre: ${genre}
Primary metric: ${summary.primaryMetricName}
Winner: ${summary.winnerLabel ?? 'unknown'} | Loser: ${summary.loserLabel ?? 'unknown'}${
                summary.liftPercent != null ? ` | Lift: ${summary.liftPercent.toFixed(1)}%` : ''
              }
Thumbnail variants:
${thumbnailSummary}

Here is the developer's statistics screenshot with the thumbnail previews:`,
            },
            { type: 'file', mediaType: stats.mediaType, data: stats.data },
            { type: 'text', text: `Below are the current top ${genre} games on Roblox for comparison:` },
            ...benchmarkParts,
          ],
        },
      ],
    })

    return Response.json({
      feedback: output,
      benchmarks: topGames.map(({ name, universeId, rootPlaceId, thumbnailUrl, playerCount }) => ({
        name,
        universeId,
        rootPlaceId,
        thumbnailUrl,
        playerCount,
      })),
    })
  } catch (error) {
    console.error('[feedback] failed', error)
    return aiErrorResponse(error, 'Could not generate feedback. Please try again.')
  }
}
