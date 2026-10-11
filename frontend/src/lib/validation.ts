// Typed client for the validation-day API (the backend lives on :8000, Vite proxies /api).

export type Verdict = 'OK' | 'FALLBACKS' | 'INCOMPLETE' | 'INVALID' | 'ERROR'
export type RunState = 'idle' | 'uploaded' | 'running' | 'done' | 'error'

export interface UploadResult {
  session: string
  count: number
  cameras: string[]
  layout: 'camera_folders' | 'flat'
}

export interface ValidatorResult {
  images: number
  areas: number
  errors: number
  ok: boolean
}

export interface ValidationStatus {
  state: RunState
  session: string | null
  photos: number
  log: string[]
  verdict: Verdict | null
  last_line: string | null
  validator: ValidatorResult | null
  exit_code: number | null
  seconds: number | null
}

export interface StockCounts {
  empty: number
  half: number
  full: number
  not_compliant: number
}

export interface ValidationSummary {
  cameras: Record<string, StockCounts>
  totals: StockCounts
}

/** A picked file with the path it should keep on the server (camera folders included). */
export interface PickedFile {
  file: File
  path: string
}

export class ApiError extends Error {
  kind: 'down' | 'busy' | 'http'
  status: number
  constructor(kind: 'down' | 'busy' | 'http', message: string, status = 0) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

async function call(url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('down', 'backend down')
  }
  // The Vite proxy answers 5xx with an empty body when nothing listens on :8000.
  if (res.status === 409) throw new ApiError('busy', 'busy', 409)
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = String(body.detail ?? body.error ?? '')
    } catch {
      /* not JSON */
    }
    if (!detail && res.status >= 502) throw new ApiError('down', 'backend down', res.status)
    throw new ApiError('http', detail || `HTTP ${res.status}`, res.status)
  }
  return res
}

export async function uploadPhotos(files: PickedFile[], append = false): Promise<UploadResult> {
  const body = new FormData()
  for (const f of files) body.append('files', f.file, f.path)
  const res = await call(`/api/validation/upload${append ? '?append=1' : ''}`, { method: 'POST', body })
  return res.json()
}

export async function startRun(opts: { expect_images: number; expect_areas: number; stock_mode?: string }) {
  await call('/api/validation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function getStatus(): Promise<ValidationStatus> {
  return (await call('/api/validation/status')).json()
}

export async function getSummary(): Promise<ValidationSummary> {
  return (await call('/api/validation/summary')).json()
}

export const RESULT_URL = '/api/validation/result'

const IMAGE = /\.(jpe?g|png|webp)$/i

/** Files from an input element. webkitRelativePath keeps the camera folder. */
export function fromInput(list: FileList | null): PickedFile[] {
  return Array.from(list ?? [])
    .filter((f) => IMAGE.test(f.name))
    .map((file) => ({ file, path: file.webkitRelativePath || file.name }))
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walk(entry: FileSystemEntry, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((ok, no) => (entry as FileSystemFileEntry).file(ok, no))
    if (IMAGE.test(file.name)) out.push({ file, path: entry.fullPath.replace(/^\//, '') })
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns at most ~100 items per call, so keep asking until it is empty.
    for (;;) {
      const batch = await readEntries(reader)
      if (batch.length === 0) break
      for (const child of batch) await walk(child, out)
    }
  }
}

/** Files from a drop, walking dropped folders. */
export async function fromDrop(data: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(data.items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e)
  if (entries.length === 0) return fromInput(data.files)
  const out: PickedFile[] = []
  for (const e of entries) await walk(e, out)
  return out
}
