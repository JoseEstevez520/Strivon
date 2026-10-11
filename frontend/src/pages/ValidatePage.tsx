import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone } from '@/components/validate/DropZone'
import { SummaryTable } from '@/components/validate/SummaryTable'
import { useI18n } from '@/lib/i18n'
import { showValidation } from '@/model/source'
import {
  ApiError,
  RESULT_URL,
  getStatus,
  getSummary,
  startRun,
  uploadPhotos,
  type PickedFile,
  type UploadResult,
  type ValidationStatus,
  type ValidationSummary,
  type Verdict,
} from '@/lib/validation'

const EXPECTED_IMAGES = 26
const EXPECTED_AREAS = 289

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-title">{title}</h2>
      {children}
    </section>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-ui text-danger">
      {children}
    </p>
  )
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <label className="grid flex-1 gap-1 text-label text-fg">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-11 w-full min-w-24 rounded-lg border border-line bg-raised px-3 text-copy tabular-nums disabled:opacity-50"
      />
    </label>
  )
}

export function ValidatePage() {
  const { t } = useI18n()
  const v = t.validate
  const [upload, setUpload] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<ValidationStatus | null>(null)
  const [summary, setSummary] = useState<ValidationSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expImages, setExpImages] = useState(EXPECTED_IMAGES)
  const [expAreas, setExpAreas] = useState(EXPECTED_AREAS)
  const [polling, setPolling] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const logEnd = useRef<HTMLPreElement>(null)

  const fail = useCallback(
    (e: unknown, wrap?: (why: string) => string) => {
      if (e instanceof ApiError && e.kind === 'down') setError(v.backendDown)
      else if (e instanceof ApiError && e.kind === 'busy') setError(v.busy)
      else {
        const why = e instanceof Error ? e.message : String(e)
        setError(wrap ? wrap(why) : why)
      }
    },
    [v],
  )

  // Pick up a run that was already going (or finished) when the page opens.
  useEffect(() => {
    getStatus()
      .then((s) => {
        setStatus(s)
        if (s.state === 'running') setPolling(true)
      })
      .catch((e) => fail(e))
  }, [fail])

  const running = status?.state === 'running'

  useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      try {
        const s = await getStatus()
        setStatus(s)
        if (s.state !== 'running') setPolling(false)
      } catch (e) {
        fail(e)
        setPolling(false)
      }
    }, 1500)
    return () => clearInterval(id)
  }, [polling, fail])

  useEffect(() => {
    if (!running) return
    const t0 = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 500)
    return () => {
      clearInterval(id)
    }
  }, [running])

  useEffect(() => {
    logEnd.current?.scrollTo({ top: logEnd.current.scrollHeight })
  }, [status?.log.length])

  const state = status?.state
  useEffect(() => {
    if (state !== 'done') return
    getSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [state])

  const onPick = async (files: PickedFile[]) => {
    setError(null)
    setSummary(null)
    setUploading(true)
    try {
      setUpload(await uploadPhotos(files))
      setStatus(await getStatus())
    } catch (e) {
      setUpload(null)
      fail(e, v.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  const run = async () => {
    setError(null)
    setSummary(null)
    setElapsed(0)
    try {
      await startRun({ expect_images: expImages, expect_areas: expAreas })
      setStatus((s) => (s ? { ...s, state: 'running', log: [], verdict: null, validator: null } : s))
      setPolling(true)
    } catch (e) {
      fail(e, v.runFailed)
    }
  }

  const photos = upload?.count ?? status?.photos ?? 0
  const hasPhotos = photos > 0
  const verdict: Verdict | null = status?.verdict ?? null
  const finished = status?.state === 'done' || status?.state === 'error'
  const canDownload = verdict === 'OK' && status?.validator?.ok === true

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <header className="grid gap-2">
        <h1 className="text-display">{v.title}</h1>
        <p className="text-ui text-fg-secondary">{v.intro}</p>
      </header>

      {error && <Alert>{error}</Alert>}

      <Step title={v.step1}>
        <DropZone disabled={uploading || running} onPick={onPick} />
        {uploading && <p className="text-ui text-fg-secondary">{v.uploading}</p>}
        {hasPhotos && !uploading && (
          <div className="grid gap-1 text-ui">
            <p className="text-label text-fg">{v.photos(photos)}</p>
            {upload && upload.cameras.length > 0 && (
              <p className="break-words text-fg-secondary">{v.cameras(upload.cameras.length, upload.cameras.join(', '))}</p>
            )}
            {upload?.layout === 'flat' && <p className="text-warning">{v.flat}</p>}
            {photos !== EXPECTED_IMAGES && <p className="text-warning">{v.countWarning(photos, EXPECTED_IMAGES)}</p>}
          </div>
        )}
      </Step>

      <Step title={v.step2}>
        <div className="flex flex-wrap gap-3">
          <NumberField label={v.expectImages} value={expImages} onChange={setExpImages} disabled={running} />
          <NumberField label={v.expectAreas} value={expAreas} onChange={setExpAreas} disabled={running} />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!hasPhotos || running || uploading}
          className="h-12 w-full cursor-pointer rounded-lg bg-fg px-6 text-label text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:w-fit"
        >
          {running ? v.running : v.run}
        </button>
        {!hasPhotos && <p className="text-ui text-fg-muted">{v.needPhotos}</p>}
        {running && <p className="text-ui text-fg-secondary tabular-nums">{v.elapsed(clock(elapsed))}</p>}
        {status && status.log.length > 0 && (
          <div className="grid gap-1">
            <h3 className="text-label text-fg">{v.log}</h3>
            <pre
              ref={logEnd}
              className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-fg p-3 font-mono text-meta leading-relaxed text-bg"
            >
              {status.log.join('\n')}
            </pre>
          </div>
        )}
      </Step>

      {finished && (
        <Step title={v.step3}>
          <div
            className={`grid gap-2 rounded-xl border-2 p-4 ${verdict === 'OK' ? 'border-success' : 'border-danger'}`}
          >
            <p className={`text-display ${verdict === 'OK' ? 'text-success' : 'text-danger'}`}>
              <span aria-hidden>{verdict === 'OK' ? '✓ ' : '! '}</span>
              {verdict ? v.verdict[verdict] : v.verdict.ERROR}
            </p>
            <p className="text-copy text-fg">{verdict ? v.advice[verdict] : v.advice.ERROR}</p>
            {status?.last_line && <p className="break-words font-mono text-meta text-fg-secondary">{status.last_line}</p>}
          </div>

          {status?.validator && (
            <p className={`text-ui tabular-nums ${status.validator.ok ? 'text-fg-secondary' : 'text-danger'}`}>
              {v.validatorLine(status.validator.images, status.validator.areas, status.validator.errors)}
              {!status.validator.ok && ` · ${v.validatorFailed}`}
            </p>
          )}

          {summary && <SummaryTable summary={summary} />}

          {canDownload && (
            <button
              type="button"
              onClick={() => showValidation(true, '/')}
              className="h-12 w-full cursor-pointer rounded-lg border border-line px-6 text-label text-fg sm:w-fit"
            >
              {t.viewOpen}
            </button>
          )}

          <div className="grid gap-1">
            {canDownload ? (
              <a
                href={RESULT_URL}
                download="final.json"
                className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-fg px-6 text-label text-bg sm:w-fit"
              >
                {v.download}
              </a>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="h-12 w-full cursor-not-allowed rounded-lg bg-fg px-6 text-label text-bg opacity-40 sm:w-fit"
                >
                  {v.download}
                </button>
                <p className="text-meta text-fg-muted">{v.downloadLocked}</p>
              </>
            )}
          </div>
        </Step>
      )}
    </div>
  )
}
