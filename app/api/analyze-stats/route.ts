import { generateText, Output } from 'ai'
import { visionModel } from '@/lib/ai-model'
import { z } from 'zod'
import { aiErrorResponse } from '@/lib/ai-error'
import { dataUrlToBytes, imageDataUrlSchema } from '@/lib/data-url'
import { rankThumbnails } from '@/lib/ranking'
import { statsExtractionSchema } from '@/lib/schemas'

export const maxDuration = 60

const bodySchema = z.object({ image: imageDataUrlSchema })

const SYSTEM = `You read screenshots from the Roblox Creator Dashboard (thumbnail personalization, thumbnail A/B tests, experience analytics) and extract the numbers exactly as displayed.
Rules:
- Extract one entry per thumbnail variant, in the order they appear (left-to-right, top-to-bottom).
- Copy numbers exactly. Convert "12.4K" to 12400 and "1.2M" to 1200000. Percentages become plain numbers (4.2% -> 4.2).
- Choose the primary metric Roblox uses to judge thumbnails (usually Qualified Play-Through Rate, otherwise Play-Through Rate or CTR). Use null for values that are not visible; never invent data.
- For each thumbnail preview image, return its bounding box as [ymin, xmin, ymax, xmax] normalized 0-1000.
- If the image is not thumbnail statistics, set isThumbnailStats to false and return an empty thumbnails array.`

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Please upload a PNG, JPEG or WebP screenshot under 3MB.' }, { status: 400 })
  }

  const { data, mediaType } = dataUrlToBytes(parsed.data.image)

  try {
    const { output } = await generateText({
      model: visionModel,
      maxRetries: 4,
      system: SYSTEM,
      output: Output.object({ schema: statsExtractionSchema }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the thumbnail statistics from this screenshot.' },
            { type: 'file', mediaType, data },
          ],
        },
      ],
    })

    if (!output.isThumbnailStats || output.thumbnails.length === 0) {
      return Response.json(
        { error: "That doesn't look like a thumbnail stats screenshot. Try a capture of your Creator Dashboard thumbnail test." },
        { status: 422 },
      )
    }

    return Response.json(rankThumbnails(output))
  } catch (error) {
    console.error('[analyze-stats] failed', error)
    return aiErrorResponse(error, 'Could not read the screenshot. Please try again.')
  }
}
