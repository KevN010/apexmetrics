import { generateText, Output } from 'ai'
import { visionModel } from '@/lib/ai-model'
import { z } from 'zod'
import { aiErrorResponse } from '@/lib/ai-error'
import { dataUrlToBytes, imageDataUrlSchema } from '@/lib/data-url'
import { rankThumbnails } from '@/lib/ranking'
import { statsExtractionSchema } from '@/lib/schemas'

export const maxDuration = 60

const bodySchema = z.object({ image: imageDataUrlSchema })
const THUMBNAIL_COLUMN_X_MIN = 0
const THUMBNAIL_COLUMN_X_MAX = 200

const SYSTEM = `You read screenshots from the Roblox Creator Dashboard (thumbnail personalization, thumbnail A/B tests, experience analytics) and extract the numbers exactly as displayed.
Rules:
- Extract one entry per thumbnail variant, in the order they appear (top-to-bottom for table rows, left-to-right then top-to-bottom for cards). Skip aggregate or summary rows labeled or identified as "Total". Set id to null when no identifier is displayed.
- Use the visible thumbnail name if present. Do not use status values such as "Active" as a thumbnail name; if there is no name, label variants sequentially as "Thumbnail 1", "Thumbnail 2", and so on.
- Copy numbers exactly. Convert "12.4K" to 12400 and "1.2M" to 1200000. Percentages become plain numbers (4.2% -> 4.2).
- Choose the primary metric Roblox uses to judge thumbnails (usually Qualified Play-Through Rate, otherwise Play-Through Rate or CTR). Use null for values that are not visible; never invent data.
- Set box to null. Thumbnail crop windows are calculated from the ordered data rows after extraction.
- If the image is not thumbnail statistics, set isThumbnailStats to false and return an empty thumbnails array.`

function isStatusLabel(label: string): boolean {
  return /^(active|inactive|enabled|disabled|running|paused|live|draft)$/i.test(label.trim())
}

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

    const thumbnails = output.thumbnails
      .filter((thumbnail) => thumbnail.id?.trim().toLowerCase() !== 'total' && thumbnail.label.trim().toLowerCase() !== 'total')
      .map((thumbnail, index) => ({
        ...thumbnail,
        label: isStatusLabel(thumbnail.label) ? `Thumbnail ${index + 1}` : thumbnail.label,
        box: null,
      }))
    const result = rankThumbnails({ ...output, thumbnails })
    if (result.thumbnails.length === 0) {
      return Response.json(
        { error: 'No individual thumbnail variants were found. Upload a screenshot that includes the test rows.' },
        { status: 422 },
      )
    }

    const rowCount = result.thumbnails.length
    const withBoxes = {
      ...result,
      thumbnails: result.thumbnails.map((thumbnail, rowIndex) => ({
        ...thumbnail,
        box: [
          Math.round((rowIndex / rowCount) * 1000),
          THUMBNAIL_COLUMN_X_MIN,
          Math.round(((rowIndex + 1) / rowCount) * 1000),
          THUMBNAIL_COLUMN_X_MAX,
        ],
      })),
    }
    const finalResult = rankThumbnails(withBoxes)

    return Response.json(finalResult)
  } catch (error) {
    console.error('[analyze-stats] failed', error)
    return aiErrorResponse(error, 'Could not read the screenshot. Please try again.')
  }
}
