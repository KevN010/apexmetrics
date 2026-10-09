import { getGenres, getTopGames } from '@/lib/roblox'

export async function GET(req: Request) {
  const genre = new URL(req.url).searchParams.get('genre')

  try {
    if (!genre) return Response.json({ genres: await getGenres() })
    return Response.json({ genre, games: await getTopGames(genre) })
  } catch (error) {
    console.error('[top-games] failed', error)
    return Response.json({ error: 'Could not load Roblox charts right now.' }, { status: 502 })
  }
}
