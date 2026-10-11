import { generateText } from 'ai'
import { z } from 'zod'
import { aiErrorResponse } from '@/lib/ai-error'
import { visionModel } from '@/lib/ai-model'
import { dataUrlToBytes } from '@/lib/data-url'

export const maxDuration = 120

const imageSchema = z
  .string()
  .max(12_000_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('upscale'),
    gameName: z.string().trim().min(1).max(120),
    imageDataUrl: imageSchema,
  }),
  z.object({
    action: z.literal('feedback'),
    gameName: z.string().trim().min(1).max(120),
    imageDataUrl: imageSchema,
    question: z.string().trim().min(3).max(500),
  }),
])

async function upscale(imageDataUrl: string, gameName: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('OPENAI_API_KEY is not set'), { name: 'AI_LoadAPIKeyError' })
  }
  const { mediaType, data } = dataUrlToBytes(imageDataUrl)
  const form = new FormData()
  const entrenchedLock =
    gameName.trim().toLocaleLowerCase() === 'entrenched'
      ? ' Preserve the same WW1 trench warfare setting, Roblox soldier in 1914 uniform and hat, aiming posture, and period-accurate weapon. NEVER add an MP5, modern firearm, modern tactical gear, or any non-WW1 asset.'
      : ''
  form.set(
    'prompt',
    `Refine this Roblox game thumbnail for "${gameName}" while maintaining at least 90% identical visual consistency. Preserve the exact existing composition, subject identity, character model, posture, weapon/equipment, environment, colors, and style. Only improve clarity, edge detail, lighting quality, and texture; do not add, remove, replace, or reposition any content.${entrenchedLock} Do not add text or logos.`,
  )
  form.set('model', 'gpt-image-1')
  form.set('size', '1536x1024')
  form.set('quality', 'high')
  form.set('input_fidelity', 'high')
  form.set('output_format', 'jpeg')
  form.set('image', new Blob([data], { type: mediaType }), 'thumbnail.jpg')
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!response.ok) {
    throw Object.assign(new Error(`OpenAI image refinement failed (${response.status}).`), {
      statusCode: response.status,
    })
  }
  const parsed = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).min(1) }).safeParse(
    await response.json(),
  )
  if (!parsed.success) throw new Error('OpenAI did not return a refined thumbnail.')
  return `data:image/jpeg;base64,${parsed.data.data[0].b64_json}`
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request.' }, { status: 400 })

  try {
    const { mediaType, data } = dataUrlToBytes(parsed.data.imageDataUrl)
    if (parsed.data.action === 'upscale') {
      return Response.json({
        imageDataUrl: await upscale(parsed.data.imageDataUrl, parsed.data.gameName),
      })
    }

    const { text } = await generateText({
      model: visionModel,
      maxRetries: 2,
      system:
        'You are a practical Roblox thumbnail art director. Give specific, visual feedback on the supplied image. Do not assume details that are not visible. Keep feedback concise and actionable.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Target game: ${parsed.data.gameName}\nQuestion: ${parsed.data.question}\nAnalyze the thumbnail in direct response to the question.`,
            },
            { type: 'file', mediaType, data },
          ],
        },
      ],
    })
    return Response.json({ feedback: text })
  } catch (error) {
    console.error('[concept-action] failed', error)
    return aiErrorResponse(error, 'Could not complete this thumbnail action. Please try again.')
  }
}
