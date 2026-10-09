import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompact } from '@/lib/format'
import type { TopGame } from '@/lib/schemas'

type Props = {
  games: TopGame[] | undefined
  loading: boolean
  error?: string
}

export function BenchmarkGallery({ games, loading, error }: Props) {
  if (error) {
    return <p className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
  }

  if (loading || !games) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video w-full" />
        ))}
      </div>
    )
  }

  if (games.length === 0) {
    return <p className="text-sm text-muted-foreground">No ranked games in this genre right now.</p>
  }

  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((game, i) => (
        <li key={game.universeId}>
          <a
            href={`https://www.roblox.com/games/${game.rootPlaceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
              {game.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.thumbnailUrl}
                  alt={`${game.name} thumbnail`}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground">
                #{i + 1}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-foreground group-hover:text-primary">{game.name}</span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                <Users className="size-3" aria-hidden="true" />
                {formatCompact(game.playerCount)}
              </span>
            </div>
          </a>
        </li>
      ))}
    </ol>
  )
}
