'use client'

import { useId, useRef, useState } from 'react'
import { ImageUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  image: string | null
  description: string
  disabled?: boolean
  onFile: (file: File) => void
}

export function ImageReferenceInput({ label, image, description, disabled = false, onFile }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function acceptFile(file?: File) {
    if (file?.type.startsWith('image/')) onFile(file)
  }

  return (
    <div
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label} image upload area. Choose a file, drag an image here, or paste an image.`}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-md border border-dashed border-input bg-background/30 p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'border-primary bg-primary/10',
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        acceptFile(event.dataTransfer.files[0])
      }}
      onPaste={(event) => {
        const image =
          Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/')) ??
          Array.from(event.clipboardData.items)
            .find((item) => item.type.startsWith('image/'))
            ?.getAsFile() ??
          undefined
        if (image) {
          event.preventDefault()
          acceptFile(image)
        }
      }}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          acceptFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div className="flex min-w-0 items-center gap-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`${label} reference`} className="aspect-video w-28 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="flex aspect-video w-28 shrink-0 items-center justify-center rounded-md bg-muted/60">
            <ImageUp className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{image ? description : 'Upload, drop, or paste an image.'}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label={`${image ? 'Replace' : 'Upload'} ${label.toLowerCase()}`}
      >
        <ImageUp aria-hidden="true" />
        {image ? 'Replace image' : `Upload ${label.toLowerCase()}`}
      </Button>
    </div>
  )
}
