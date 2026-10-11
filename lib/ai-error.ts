type ErrorLike = {
  name?: string
  message?: string
  code?: string
  statusCode?: number
  responseBody?: string
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
    (e) => e.name === 'AI_LoadAPIKeyError' || e.message?.includes('OPENAI_API_KEY'),
  )
  if (isMissingKey) {
    return Response.json(
      {
        error: 'No OpenAI API key is set. For local development, add OPENAI_API_KEY to .env.local in the project folder, then restart the dev server. For deployment, set it in your hosting provider’s environment variables.',
      },
      { status: 503 },
    )
  }

  const isAuthError = chain.some(
    (e) =>
      e.statusCode === 401 ||
      e.statusCode === 403 ||
      e.message?.toLowerCase().includes('api key not valid') ||
      e.message?.toLowerCase().includes('incorrect api key'),
  )
  if (isAuthError) {
    return Response.json(
      {
        error: 'OpenAI rejected the API key. Check that OPENAI_API_KEY is valid in .env.local or your hosting provider’s environment variables.',
      },
      { status: 503 },
    )
  }

  const isOutOfCredits = chain.some(
    (e) =>
      e.message?.toLowerCase().includes('no credits remaining') ||
      e.message?.toLowerCase().includes('insufficient_quota') ||
      e.message?.toLowerCase().includes('billing hard limit'),
  )
  if (isOutOfCredits) {
    return Response.json(
      { error: 'The OpenAI account has no API credits remaining. Add credits in the OpenAI billing settings, then try again.' },
      { status: 503 },
    )
  }

  const isRateLimited = chain.some(
    (e) => e.statusCode === 429 || e.message?.toLowerCase().includes('resource_exhausted'),
  )
  if (isRateLimited) {
    return Response.json(
      { error: 'OpenAI rate limit reached. Wait a moment and try again.' },
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
    return Response.json({ error: 'OpenAI is busy right now. Wait a few seconds and try again.' }, { status: 503 })
  }

  const imageGenerationError = chain.find((e) => e.name === 'OpenAIImageGenerationError')
  if (imageGenerationError) {
    return Response.json(
      { error: imageGenerationError.message ?? fallback },
      { status: 502 },
    )
  }

  const providerErrorMessage = chain
    .map((e) => {
      if (!e.responseBody) return undefined
      try {
        const body: unknown = JSON.parse(e.responseBody)
        if (typeof body !== 'object' || body === null || !('error' in body)) return undefined
        const providerError = body.error
        if (typeof providerError !== 'object' || providerError === null || !('message' in providerError)) {
          return undefined
        }
        return typeof providerError.message === 'string' ? providerError.message : undefined
      } catch {
        return undefined
      }
    })
    .find((message) => message)
  if (providerErrorMessage) {
    return Response.json({ error: `OpenAI request failed: ${providerErrorMessage}` }, { status: 502 })
  }

  return Response.json({ error: fallback }, { status: 500 })
}
