const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export function formatCompact(value: number | null | undefined) {
  return value == null ? '—' : compact.format(value)
}

export function formatMetric(value: number | null | undefined, metricName: string) {
  if (value == null) return '—'
  const isRate = /rate|ctr|%|through/i.test(metricName)
  return isRate ? `${value.toFixed(2)}%` : compact.format(value)
}

export async function postJson<T>(url: string, { arg }: { arg: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data as T
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data as T
}
