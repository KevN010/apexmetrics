type ErrorLike = {
  name?: string
  message?: string
  statusCode?: number
  cause?: unknown
  lastError?: unknown
  errors?: unknown[]
}

function collectErrors(error: unknown, seen = new Set<unknown>()): ErrorLike[] {
  if (!error || typeof error !== 'object' || seen.has(error)) return []
  seen.add(error)
  const e = error as ErrorLike
  return [
    e,
    ...collectErrors(e.cause, seen),
    ...collectErrors(e.lastError, seen),
    ...(Array.isArray(e.errors) ? e.errors.flatMap((inner) => collectErrors(inner, seen)) : []),
  ]
}

export function aiErrorResponse(error: unknown, fallback: string) {
  const chain = collectErrors(error)

  const isMissingKey = chain.some(
    (e) => e.name === 'AI_LoadAPIKeyError' || e.message?.includes('GOOGLE_GENERATIVE_AI_API_KEY'),
  )
  if (isMissingKey) {
    return Response.json(
      {
        error:
          'No Google Gemini API key is set. Get a free key at aistudio.google.com/apikey and add it as GOOGLE_GENERATIVE_AI_API_KEY in the Vars settings.',
      },
      { status: 503 },
    )
  }

  const isAuthError = chain.some(
    (e) =>
      e.statusCode === 401 ||
      e.statusCode === 403 ||
      e.message?.toLowerCase().includes('api key not valid'),
  )
  if (isAuthError) {
    return Response.json(
      {
        error:
          'Google rejected the Gemini API key. Check that GOOGLE_GENERATIVE_AI_API_KEY in the Vars settings matches the key from aistudio.google.com/apikey.',
      },
      { status: 503 },
    )
  }

  const isRateLimited = chain.some(
    (e) => e.statusCode === 429 || e.message?.toLowerCase().includes('resource_exhausted'),
  )
  if (isRateLimited) {
    return Response.json(
      {
        error:
          'You hit the Gemini free-tier limit. Wait a minute and try again (the daily quota resets every 24 hours).',
      },
      { status: 429 },
    )
  }

  const isOverloaded = chain.some(
    (e) =>
      e.statusCode === 500 ||
      e.statusCode === 503 ||
      e.message?.toLowerCase().includes('overloaded') ||
      e.message?.toLowerCase().includes('unavailable'),
  )
  if (isOverloaded) {
    return Response.json(
      { error: 'Gemini is busy right now (common on the free tier). Wait a few seconds and try again.' },
      { status: 503 },
    )
  }

  return Response.json({ error: fallback }, { status: 500 })
}
