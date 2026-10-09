import { ThumbnailArena } from '@/components/thumbnail-arena'

export default function Page() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-8 rotate-12 items-center justify-center rounded-sm bg-foreground" aria-hidden="true">
              <span className="size-2.5 rounded-[2px] bg-background" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">Thumbnail Arena</span>
          </div>
          <p className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground sm:block">
            Live data from Roblox charts
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-8 md:py-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Find out which thumbnail actually wins.
          </h1>
          <p className="text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            Drop in your thumbnail stats, see the winner and loser instantly, then stack them up against the top 100
            games in your genre for AI feedback on what to change next.
          </p>
        </div>
        <ThumbnailArena />
      </main>
    </div>
  )
}
