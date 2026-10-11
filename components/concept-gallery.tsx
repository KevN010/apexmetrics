'use client'

import { useState } from 'react'
import { Download, Loader2, MessageCircle, Sparkles, WandSparkles } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { postJson } from '@/lib/format'

type Concept = {
  id: string
  label: string
  category: 'derivative' | 'competitor'
  prompt: string
  imageDataUrl: string
  inspiredBy?: string
}

type Props = {
  concepts: Concept[]
  gameName: string
}

function ConceptCard({ concept, gameName }: { concept: Concept; gameName: string }) {
  const [imageDataUrl, setImageDataUrl] = useState(concept.imageDataUrl)
  const [question, setQuestion] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [pending, setPending] = useState<'upscale' | 'feedback' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runAction(action: 'upscale' | 'feedback') {
    setPending(action)
    setError(null)
    try {
      if (action === 'upscale') {
        const result = await postJson<{ imageDataUrl: string }>('/api/concept-action', {
          arg: { action, gameName, imageDataUrl },
        })
        setImageDataUrl(result.imageDataUrl)
      } else {
        const result = await postJson<{ feedback: string }>('/api/concept-action', {
          arg: { action, gameName, imageDataUrl, question },
        })
        setFeedback(result.feedback)
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not complete this action.')
    } finally {
      setPending(null)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-background/50 p-3">
      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageDataUrl} alt={`${concept.label} for ${gameName}`} className="size-full object-cover" />
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold text-foreground">{concept.label}</h4>
        {concept.category === 'competitor' && concept.inspiredBy && (
          <p className="text-xs font-medium text-muted-foreground">Inspired by {concept.inspiredBy}</p>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">View concept prompt</summary>
          <p className="mt-2 leading-relaxed">{concept.prompt}</p>
        </details>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={imageDataUrl}
          download={`${gameName}-${concept.id}.${imageDataUrl.startsWith('data:image/png;') ? 'png' : 'jpg'}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          <Download aria-hidden="true" />
          Download
        </a>
        <Button variant="secondary" size="sm" disabled={pending !== null} onClick={() => runAction('upscale')}>
          {pending === 'upscale' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <WandSparkles aria-hidden="true" />}
          Upscale
        </Button>
        <Button variant="ghost" size="sm" disabled={pending !== null} onClick={() => setFeedbackOpen((open) => !open)}>
          <MessageCircle aria-hidden="true" />
          Request feedback
        </Button>
      </div>
      {feedbackOpen && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void runAction('feedback')
          }}
        >
          <label htmlFor={`${concept.id}-question`} className="text-xs font-medium text-muted-foreground">
            What should the AI focus on?
          </label>
          <textarea
            id={`${concept.id}-question`}
            className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="For example: Is the focal point clear at small sizes?"
            value={question}
            maxLength={500}
            required
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button size="sm" disabled={pending !== null || question.trim().length < 3}>
            {pending === 'feedback' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            Get feedback
          </Button>
        </form>
      )}
      {feedback && <p className="rounded-md bg-muted/60 p-3 text-sm leading-relaxed text-foreground">{feedback}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </article>
  )
}

export function ConceptGallery({ concepts, gameName }: Props) {
  const derivatives = concepts.filter((concept) => concept.category === 'derivative')
  const competitors = concepts.filter((concept) => concept.category === 'competitor')

  return (
    <div className="flex flex-col gap-8">
      {[
        { title: 'Winner Derivatives', description: 'Three iterations built from your winning thumbnail.', items: derivatives },
        {
          title: 'Competitor-Inspired Concepts',
          description: `Three composition and FX variations inspired by ${competitors[0]?.inspiredBy ?? 'your selected competitor'}; target art identity remains dominant.`,
          items: competitors,
        },
      ].map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-foreground">{section.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {section.items.map((concept) => (
              <ConceptCard key={concept.id} concept={concept} gameName={gameName} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
