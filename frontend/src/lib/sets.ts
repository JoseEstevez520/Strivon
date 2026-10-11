// Typed client for the validation sets API (/api/sets). Upload and run reuse lib/validation.ts.

import { ApiError } from '@/lib/validation'

export type SetStatus = 'done' | 'failed' | 'running' | 'uploaded'

export interface SetItem {
  id: string
  name: string
  created: string
  source: string
  photos: number
  areas: number
  has_labels: boolean
  status: SetStatus
  verdict: string | null
}

export interface Mix {
  empty: number
  half: number
  full: number
  not_compliant: number
  areas: number
  images: number
  empty_pct: number
  half_pct: number
  full_pct: number
  not_compliant_pct: number
}

export interface WorstArea {
  camera: string
  image: string
  area: string
  points: number
  predicted: { compliant: boolean; stock: number } | null
  true: { compliant: boolean; stock: number }
}

export interface CameraScore {
  total: number
  max: number
  percent: number
  areas: number
  ident_ok_pct: number
  stock_ok_pct: number
}

export interface SetScore {
  total: number
  max: number
  percent: number
  ident: number
  ident_max: number
  ident_pct: number
  stock: number
  stock_max: number
  stock_pct: number
  areas: number
  ident_ok: number
  ident_ok_pct: number
  stock_ok: number
  stock_ok_pct: number
  below: number
  above: number
  missing: number
  unlabelled: number
  worst: WorstArea[]
  cameras: Record<string, CameraScore>
  labels_source: 'team' | 'upload'
}

export interface SetDetail extends SetItem {
  cameras: Record<string, Mix>
  totals: Mix | null
  images: Record<string, string[]>
  score: SetScore | null
}

async function call(url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('down', 'backend down')
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = String((await res.json()).detail ?? '')
    } catch {
      /* not JSON */
    }
    if (!detail && res.status >= 502) throw new ApiError('down', 'backend down', res.status)
    throw new ApiError(res.status === 409 ? 'busy' : 'http', detail || `HTTP ${res.status}`, res.status)
  }
  return res
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export async function listSets(): Promise<SetItem[]> {
  return (await call('/api/sets')).json()
}

export async function getSet(id: string): Promise<SetDetail> {
  return (await call(`/api/sets/${encodeURIComponent(id)}`)).json()
}

export async function renameSet(id: string, name: string): Promise<void> {
  await call(`/api/sets/${encodeURIComponent(id)}`, json('PATCH', { name }))
}

export async function deleteSet(id: string): Promise<void> {
  await call(`/api/sets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function postLabels(
  id: string,
  body: { use: 'team' } | Record<string, unknown>,
): Promise<{ areas: number; dropped: number }> {
  return (await call(`/api/sets/${encodeURIComponent(id)}/labels`, json('POST', body))).json()
}

/** Overall score of a set in percent of the maximum, or null when it has no labels. */
export const scorePct = (d: SetDetail): number | null => d.score?.percent ?? null
