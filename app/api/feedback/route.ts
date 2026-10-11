import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { aiErrorResponse } from '@/lib/ai-error'
import { dataUrlToBytes, imageDataUrlSchema } from '@/lib/data-url'
import { getTopGames } from '@/lib/roblox'
import { feedbackSchema } from '@/lib/schemas'

export const maxDuration = 120

const BENCHMARK_COUNT = 10
const COMPETITOR_SELECTION_COUNT = 100
const imageGenerationResponseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
})
const imageGenerationErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.string().optional(),
  }),
})
const derivativeAdjustments = [
  {
    label: 'Color grade',
    change: 'increase saturation by about 15% and shift color temperature slightly warmer; preserve existing light sources, shadows, palette identity, and every depicted object',
  },
  {
    label: 'Focal framing',
    change: 'tighten the crop by 15% around the existing primary character/focal point without changing the camera perspective or redrawing any assets',
  },
  {
    label: 'Micro pose variation',
    change: 'make one subtle pose-only adjustment to the existing native character, such as a small head turn or slight angle change to the already-present held object; keep the character, face, outfit, gear, environment, and all other assets identical',
  },
] as const
const competitorVariations = [
  { label: 'Closest layout match', instruction: 'match the selected competitor blueprint as closely as possible' },
  { label: 'Focal emphasis', instruction: 'keep the same camera perspective and layout, emphasizing the blueprint’s dominant focal subject within its described frame coverage' },
  { label: 'FX emphasis', instruction: 'keep the same camera perspective and layout, making the selected competitor’s described secondary FX/vibe slightly more visible while maintaining the 70/30 style balance' },
] as const

const bodySchema = z.object({
  genre: z.string().min(1).max(60),
  gameName: z.string().trim().min(1).max(120),
  competitorId: z.number().int().positive(),
  winningThumbnail: imageDataUrlSchema,
  loserThumbnail: imageDataUrlSchema.optional(),
  summary: z
    .object({
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
    })
    .optional(),
})

async function loadImage(url: string): Promise<{ data: Uint8Array; mediaType: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = new Uint8Array(await res.arrayBuffer())
    const declaredType = res.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase()
    let mediaType =
      declaredType === 'image/jpeg' || declaredType === 'image/png' || declaredType === 'image/webp'
        ? declaredType
        : null
    if (!mediaType) {
      if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) mediaType = 'image/jpeg'
      else if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
        mediaType = 'image/png'
      } else if (
        data[0] === 0x52 &&
        data[1] === 0x49 &&
        data[2] === 0x46 &&
        data[3] === 0x46 &&
        data[8] === 0x57 &&
        data[9] === 0x45 &&
        data[10] === 0x42 &&
        data[11] === 0x50
      ) {
        mediaType = 'image/webp'
      }
    }
    if (!mediaType) return null
    return { data, mediaType }
  } catch {
    return null
  }
}

async function generateThumbnailImage(
  prompt: string,
  referenceImages: { data: Uint8Array; mediaType: string; name: string }[],
) {
  if (prompt.length > 4000) {
    throw new Error(`Generated GPT Image prompt exceeds the 4000-character limit (${prompt.length}).`)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('OPENAI_API_KEY is not set'), { name: 'AI_LoadAPIKeyError' })
  }

  if (referenceImages.length === 0) {
    throw new Error('At least one reference image is required for thumbnail generation.')
  }
  const form = new FormData()
  form.set('model', 'gpt-image-2.5-sunburst')
  form.set('prompt', prompt)
  form.set('size', '1536x1024')
  form.set('quality', 'high')
  form.set('output_format', 'png')
  for (const image of referenceImages) {
    form.append('image[]', new Blob([image.data], { type: image.mediaType }), image.name)
  }

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  if (!response.ok) {
    const errorBody = imageGenerationErrorSchema.safeParse(await response.json().catch(() => null))
    const details = errorBody.success ? errorBody.data.error.message : undefined
    throw Object.assign(
      new Error(`OpenAI image generation failed (${response.status})${details ? `: ${details}` : '.'}`),
      {
        name: 'OpenAIImageGenerationError',
        code: errorBody.success ? errorBody.data.error.code : undefined,
        statusCode: response.status,
      },
    )
  }

  const parsed = imageGenerationResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error('OpenAI did not return a generated thumbnail.')
  return `data:image/png;base64,${parsed.data.data[0].b64_json}`
}

function derivativePrompt(
  gameName: string,
  adjustment: string,
) {
  return `Create one restrained iterative variation of the supplied winning thumbnail for "${gameName}" by editing that source image. The source image is image input 0 and is the only authority for target-game assets and art identity. Preserve the same native character identity, topology, face, clothing, equipment, held objects, environment, background objects, outlines, and clean Roblox render style. Do not invent, replace, or remove assets; do not add gear, helmets, clothing, props, or any detail not present in image input 0. No photorealism, metallic realism, dark cinematic mud, generic electric effects, or new lighting. Change only this requested variation: ${adjustment}.`
}

function competitorPrompt(
  gameName: string,
  competitorName: string,
  variation: string,
  blueprint: {
    perspective: string
    focalFraming: string
    visualHooks: string[]
    secondaryStyleInfluence: string
  },
  style: {
    characterTopology: string
    renderingAndShaders: string
    environmentAndTheme: string
  },
) {
  return `Re-render a high-energy Roblox thumbnail for "${gameName}". Image input 0 is the user's winning thumbnail and image input 1 is the selected competitor thumbnail. Fuse the sources with this strict balance: 70% target-game art identity from image input 0 and 30% secondary FX/vibe from image input 1. Structural composition comes from image input 1 and its blueprint.
PRIMARY ART STYLE SOURCE — 70%, WINNING THUMBNAIL:
Character and asset topology: ${style.characterTopology}
Rendering and shaders: ${style.renderingAndShaders}
Environment and theme: ${style.environmentAndTheme}
SECONDARY ART STYLE SOURCE — 30%, SELECTED COMPETITOR "${competitorName}" FX/VIBE ONLY:
${blueprint.secondaryStyleInfluence}
Use only those secondary visual effects/vibe cues that are visibly present in image input 1. Do not copy competitor character designs, assets, environment, base render style, textures, or game identity.
STRUCTURAL COMPOSITION FROM THE SELECTED COMPETITOR:
Camera perspective and FOV: ${blueprint.perspective}
Focal framing and screen coverage: ${blueprint.focalFraming}
Visual hooks, placement, and direction: ${blueprint.visualHooks.join('; ')}
Match the selected competitor's camera perspective, field of view, focal placement, scale, and object/weapon placement explicitly. Render the result in the winning thumbnail's native clean 3D Roblox presentation and style. Re-pose/re-frame only the exact target-game native character/assets; do not change their identity, face, topology, clothing, equipment, or environment. Never add details unless visibly sourced from image input 0 or a structural/FX element from image input 1. Do not add unrequested background objects or equipment. Absolutely avoid photorealistic textures, dark cinematic mud, realistic metallic rendering, and generic electric/lightning effects. Apply only the selected competitor's observed FX/vibe as a restrained 30% secondary influence over the target image's dominant 70% native identity. Concept variation: ${variation}. No text or logos.`
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request.' }, { status: 400 })

  const { genre, gameName, competitorId, winningThumbnail, loserThumbnail, summary } = parsed.data
  const leaderboardGames = await getTopGames(genre, COMPETITOR_SELECTION_COUNT)
  const topGames = leaderboardGames.slice(0, BENCHMARK_COUNT)

  if (leaderboardGames.length === 0) {
    return Response.json({ error: `No benchmark games found for ${genre}.` }, { status: 404 })
  }

  const selectedCompetitor = leaderboardGames.find(
    (game) => game.universeId === competitorId && game.thumbnailUrl,
  )
  if (!selectedCompetitor) {
    return Response.json({ error: 'Choose a competitor from the live top 100 for this genre.' }, { status: 422 })
  }

  const benchmarkImages = await Promise.all(topGames.map((g) => loadImage(g.thumbnailUrl!)))
  const selectedTopGameIndex = topGames.findIndex((game) => game.universeId === selectedCompetitor.universeId)
  const selectedCompetitorImage =
    selectedTopGameIndex >= 0
      ? benchmarkImages[selectedTopGameIndex]
      : await loadImage(selectedCompetitor.thumbnailUrl!)
  if (!selectedCompetitorImage) {
    return Response.json({ error: `Could not load the selected competitor thumbnail for ${selectedCompetitor.name}.` }, { status: 502 })
  }
  const winning = dataUrlToBytes(winningThumbnail)
  const loser = loserThumbnail ? dataUrlToBytes(loserThumbnail) : null

  const benchmarkParts = topGames.flatMap((game, i) => {
    const image = benchmarkImages[i]
    if (!image) return []
    return [
      { type: 'text' as const, text: `Live leaderboard top-10 game #${i + 1}: "${game.name}" (${game.playerCount.toLocaleString()} players now)` },
      { type: 'file' as const, mediaType: image.mediaType, data: image.data },
    ]
  })

  const thumbnailSummary = (summary?.thumbnails ?? [])
    .map((t) => `- ${t.label}: ${t.visualDescription} (${summary?.primaryMetricName ?? 'score'}: ${t.score ?? 'n/a'})`)
    .join('\n')

  try {
    const { output } = await generateText({
      model: openai('gpt-4o'),
      maxRetries: 4,
      system: `You are a senior Roblox thumbnail strategist who has optimized thumbnails for front-page games.
Give specific, visual, actionable feedback that references what is actually in the images. Avoid generic advice.
${summary ? "Score every thumbnail variant from the developer's supplied test data." : 'No A/B test metrics were supplied: do not invent scores, performance results, or claims that the image won a measured test. Analyze the supplied winner thumbnail on its visual merits.'}
Base genre trends only on the 10 live top leaderboard thumbnails provided and cite counts (e.g. "8 of 10").
Before image generation, analyze the supplied winning thumbnail in the context of the provided game name and return a dynamicStyleProfile with:
- characterTopology: visible character and asset shapes, topology, clothing/equipment, and distinctive identity;
- renderingAndShaders: actual rendering style, geometry/material finish, shaders, lighting quality, and color treatment;
- environmentAndTheme: only the setting, environment, props, and theme visible in the image;
- composition: camera perspective, framing, layout, and focal action for winner derivatives.
Treat the winning thumbnail as the sole authority for the target game's style and assets. Do not infer or impose an art style, environment, theme, palette, or assets from the genre or from common Roblox conventions.
Analyze only the user-selected competitor thumbnail for competitor inspiration. Extract its structural composition (camera perspective/FOV, focal placement/scale, weapon/object placement, and hook locations) separately from its visible secondary FX/vibe (such as speed lines, energy glow, or color splits). Return exactly one competitorBlueprint. Its secondaryStyleInfluence must be a brief, visible FX/vibe description; do not copy competitor assets, characters, setting, or base rendering style. The selected image is the sole source for this blueprint.
The final competitor concept prompt must enforce a 70% primary art-style contribution from dynamicStyleProfile and a 30% secondary FX/vibe contribution from the selected competitor. Derive the camera angle, FOV, and focal/weapon placement from the selected competitor blueprint. Recreate the target game in its winning-image-native style and identity; prohibit photorealistic textures, dark cinematic mud, realistic metal rendering, and unrequested asset/gear changes.
For Winner Derivatives, use the winning thumbnail itself as image input 0 for a true image edit. Make each of the three distinct requested variations: (1) approximately 15% saturation increase and a slight warm color-temperature shift; (2) a 15% tighter crop around the existing focal character; (3) a subtle re-pose of the existing character/held object only. Preserve the exact native assets, character identity and face, clothing, equipment, outlines, inserts, environment, background, and base rendering style. No substitutions, extra detail, unrelated effects, photorealism, or new light sources.
${loser ? 'Return a detailed winnerLoserBreakdown based only on the supplied winner and loser images. Evaluate focal point and contrast, clarity and readability at small sizes, and clickability factors. Provide 1-3 accurate image-coordinate annotations for each image (x/y percentages from its top-left) tied to the findings.' : 'Return winnerLoserBreakdown as null because no loser thumbnail was provided.'}`,
      output: Output.object({ schema: feedbackSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Target game: ${gameName}
Genre: ${genre}
The one selected competitor for this generation is "${selectedCompetitor.name}" (currently ranked #${leaderboardGames.findIndex((game) => game.universeId === selectedCompetitor.universeId) + 1} in this genre). Use its separately attached thumbnail as the only source for the competitor blueprint and 30% secondary FX/vibe.
${summary ? `Primary metric: ${summary.primaryMetricName}
Winner: ${summary.winnerLabel ?? 'unknown'} | Loser: ${summary.loserLabel ?? 'unknown'}${
                summary.liftPercent != null ? ` | Lift: ${summary.liftPercent.toFixed(1)}%` : ''
              }
Thumbnail variants:
${thumbnailSummary}` : 'No statistics screenshot or measured A/B results were provided. Do not infer statistical performance.'}

The winning thumbnail image is supplied below. ${loser ? 'The losing thumbnail image is also supplied for a direct visual comparison.' : 'Analyze it as a standalone thumbnail.'}`,
            },
            { type: 'text', text: `This is the winning thumbnail for "${gameName}". Extract its dynamic style profile and native identity from what is actually visible:` },
            { type: 'file', mediaType: winning.mediaType, data: winning.data },
            { type: 'text', text: `This is the user-selected competitor thumbnail for "${selectedCompetitor.name}". Extract its structural composition and secondary FX/vibe separately; do not use any other competitor thumbnail for the generation blueprint:` },
            { type: 'file', mediaType: selectedCompetitorImage.mediaType, data: selectedCompetitorImage.data },
            ...(loser
              ? [
                  { type: 'text' as const, text: 'This is the losing thumbnail. Compare it directly with the winning thumbnail and place annotation coordinates on the relevant visual regions:' },
                  { type: 'file' as const, mediaType: loser.mediaType, data: loser.data },
                ]
              : []),
            { type: 'text', text: `Below are the current top 10 ${genre} games on Roblox. These are the only permitted competitor inspiration sources:` },
            ...benchmarkParts,
          ],
        },
      ],
    })

    const concepts = await Promise.all([
      ...derivativeAdjustments.map(async ({ label, change }, index) => ({
        id: `derivative-${index + 1}`,
        category: 'derivative' as const,
        label: `${label} variation`,
        prompt: derivativePrompt(gameName, change),
        imageDataUrl: await generateThumbnailImage(derivativePrompt(gameName, change), [
          { ...winning, name: 'winning-thumbnail' },
        ]),
      })),
      ...competitorVariations.map(async ({ label, instruction }, index) => ({
        id: `competitor-${index + 1}`,
        category: 'competitor' as const,
        label: `${label} ${index + 1}`,
        inspiredBy: selectedCompetitor.name,
        prompt: competitorPrompt(
          gameName,
          selectedCompetitor.name,
          instruction,
          output.competitorBlueprints[0],
          output.dynamicStyleProfile,
        ),
        imageDataUrl: await generateThumbnailImage(
          competitorPrompt(
            gameName,
            selectedCompetitor.name,
            instruction,
            output.competitorBlueprints[0],
            output.dynamicStyleProfile,
          ),
          [
            { ...winning, name: 'winning-thumbnail' },
              {
                data: selectedCompetitorImage.data,
                mediaType: selectedCompetitorImage.mediaType,
                name: 'selected-competitor-thumbnail',
              },
          ],
        ),
      })),
    ])

    return Response.json({
      feedback: output,
      concepts,
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
