import 'server-only'
import type { TopGame } from './schemas'

const EXPLORE_URL = 'https://apis.roblox.com/explore-api/v1/get-sorts'
const THUMBNAIL_URL = 'https://thumbnails.roblox.com/v1/games/multiget/thumbnails'
const DEVICES = ['computer', 'high_end_phone', 'console'] as const
const MAX_SORT_PAGES = 8
const REVALIDATE_SECONDS = 60 * 60

type ExploreGame = {
  universeId: number
  rootPlaceId: number
  name: string
  playerCount: number
  totalUpVotes: number
  totalDownVotes: number
  isSponsored: boolean
  genreL1?: string
}

type ExploreResponse = {
  nextSortsPageToken?: string | null
  sorts?: { contentType: string; games?: ExploreGame[] }[]
}

async function fetchDeviceGames(device: string): Promise<ExploreGame[]> {
  const games: ExploreGame[] = []
  let pageToken = ''

  for (let page = 0; page < MAX_SORT_PAGES; page++) {
    const url = new URL(EXPLORE_URL)
    url.searchParams.set('sessionId', 'thumbnail-arena')
    url.searchParams.set('device', device)
    url.searchParams.set('country', 'all')
    if (pageToken) url.searchParams.set('sortsPageToken', pageToken)

    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } })
    if (!res.ok) break
    const data = (await res.json()) as ExploreResponse

    for (const sort of data.sorts ?? []) {
      if (sort.contentType === 'Games' && sort.games) games.push(...sort.games)
    }

    if (!data.nextSortsPageToken) break
    pageToken = data.nextSortsPageToken
  }

  return games
}

async function fetchThumbnails(universeIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  const chunks: number[][] = []
  for (let i = 0; i < universeIds.length; i += 100) chunks.push(universeIds.slice(i, i + 100))

  await Promise.all(
    chunks.map(async (ids) => {
      const url = new URL(THUMBNAIL_URL)
      url.searchParams.set('universeIds', ids.join(','))
      url.searchParams.set('countPerUniverse', '1')
      url.searchParams.set('size', '480x270')
      url.searchParams.set('format', 'Jpeg')
      url.searchParams.set('isCircular', 'false')

      const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } })
      if (!res.ok) return
      const data = (await res.json()) as {
        data?: { universeId: number; thumbnails?: { state: string; imageUrl: string | null }[] }[]
      }
      for (const entry of data.data ?? []) {
        const thumb = entry.thumbnails?.find((t) => t.state === 'Completed' && t.imageUrl)
        if (thumb?.imageUrl) result.set(entry.universeId, thumb.imageUrl)
      }
    }),
  )

  return result
}

export async function getGamesByGenre(): Promise<Map<string, Omit<TopGame, 'thumbnailUrl'>[]>> {
  const perDevice = await Promise.all(DEVICES.map(fetchDeviceGames))
  const unique = new Map<number, ExploreGame>()

  for (const game of perDevice.flat()) {
    if (game.isSponsored || !game.genreL1?.trim()) continue
    const existing = unique.get(game.universeId)
    if (!existing || game.playerCount > existing.playerCount) unique.set(game.universeId, game)
  }

  const byGenre = new Map<string, Omit<TopGame, 'thumbnailUrl'>[]>()
  for (const game of unique.values()) {
    const genre = game.genreL1!.trim()
    const list = byGenre.get(genre) ?? []
    list.push({
      universeId: game.universeId,
      rootPlaceId: game.rootPlaceId,
      name: game.name,
      playerCount: game.playerCount,
      upVotes: game.totalUpVotes,
      downVotes: game.totalDownVotes,
      genre,
    })
    byGenre.set(genre, list)
  }

  for (const list of byGenre.values()) list.sort((a, b) => b.playerCount - a.playerCount)
  return byGenre
}

export async function getGenres(): Promise<{ name: string; count: number }[]> {
  const byGenre = await getGamesByGenre()
  return [...byGenre.entries()]
    .map(([name, games]) => ({ name, count: Math.min(games.length, 100) }))
    .filter((g) => g.count >= 5)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getTopGames(genre: string, limit = 100): Promise<TopGame[]> {
  const byGenre = await getGamesByGenre()
  const games = (byGenre.get(genre) ?? []).slice(0, limit)
  const thumbs = await fetchThumbnails(games.map((g) => g.universeId))
  return games.map((g) => ({ ...g, thumbnailUrl: thumbs.get(g.universeId) ?? null }))
}
