'use client'

import { useId, useRef, useState } from 'react'
import { ImageUp, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  image: string | null
  loading: boolean
  onFile: (file: File) => void
  onReset: () => void
}

export function StatsDropzone({ image, loading, onFile, onReset }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file && file.type.startsWith('image/')) onFile(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onPaste={(e) => handleFiles(e.clipboardData.files)}
        className={cn(
          'group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed border-input bg-background/40 p-6 text-center transition-colors hover:border-primary/70 focus-within:border-primary',
          dragging && 'border-primary bg-primary/10',
          image && 'border-solid p-0',
        )}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Uploaded thumbnail statistics screenshot" className="size-full object-contain" />
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Reading stats</p>
                <div className="scan-line absolute inset-x-0 h-px bg-primary" aria-hidden="true" />
              </div>
            )}
          </>
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ImageUp className="size-6" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold text-foreground">Drop your thumbnail stats screenshot</span>
            <span className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              Capture the Thumbnails tab or your A/B test results from the Creator Dashboard. Click, drop, or paste.
            </span>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {image && !loading && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <ImageUp aria-hidden="true" />
            Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RefreshCw aria-hidden="true" />
            Start over
          </Button>
        </div>
      )}
    </div>
  )
}
