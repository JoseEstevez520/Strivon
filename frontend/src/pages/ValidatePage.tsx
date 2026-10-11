import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone } from '@/components/validate/DropZone'
import { SummaryTable } from '@/components/validate/SummaryTable'
import { toCalibFile } from '@/lib/calibration'
import { useCalibration } from '@/lib/calibrationStore'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { showValidation } from '@/model/source'
import {
  ApiError,
  RESULT_URL,
  deleteCalibration,
  putCalibration,
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

// The two "expected" fields survive a reload. Empty areas means "work it out from the photos".
const KEY = 'strivon.validate.expect'
function loadExpect(): { images: string; areas: string } {
  try {
    const o = JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
    return { images: String(Number(o.images) > 0 ? Number(o.images) : EXPECTED_IMAGES), areas: Number(o.areas) > 0 ? String(Number(o.areas)) : '' }
  } catch {
    return { images: String(EXPECTED_IMAGES), areas: '' }
  }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
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

function NumberField({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (s: string) => void; disabled: boolean; placeholder?: string }) {
  return (
    <label className="grid min-w-0 flex-1 gap-1 text-label text-fg">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
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
  const [exp, setExp] = useState(loadExpect)
  const expImages = Number(exp.images) || EXPECTED_IMAGES
  const expAreas = Number(exp.areas) || undefined
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ images: exp.images, areas: exp.areas }))
    } catch {
      /* storage unavailable: the fields just reset on reload */
    }
  }, [exp])
  const [polling, setPolling] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [useCal, setUseCal] = useState(false)
  const [calCount, setCalCount] = useState<number | null>(null)
  const { cal } = useCalibration()
  const { state: appState } = useStore()
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
        if (s.state === 'idle' && !s.session) setError(v.restarted)
      } catch (e) {
        // A backend that is down for a moment keeps the poll going; the next answer says what became of the run.
        fail(e)
        if (!(e instanceof ApiError && e.kind === 'down')) setPolling(false)
      }
    }, 1500)
    return () => clearInterval(id)
  }, [polling, fail, v])

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

  // The stored calibration belongs to the session, so a status refresh tells what the server holds.
  const stored = status?.calibration?.products ?? 0
  const calReady = calCount ?? stored
  const appProducts = Object.keys(toCalibFile(cal, appState.areas).products).length

  const sendCalibration = async (file: unknown) => {
    setError(null)
    try {
      const r = await putCalibration(file)
      setCalCount(r.products)
    } catch (e) {
      fail(e, v.calBadFile)
    }
  }

  const useMine = () => sendCalibration(toCalibFile(cal, appState.areas))

  const onCalFile = async (f: File | undefined) => {
    if (!f) return
    try {
      await sendCalibration(JSON.parse(await f.text()))
    } catch {
      setError(v.calBadFile('Not valid JSON.'))
    }
  }

  const clearCalibration = async () => {
    try {
      await deleteCalibration()
      setCalCount(0)
    } catch (e) {
      fail(e)
    }
  }

  const onPick = async (files: PickedFile[]) => {
    setError(null)
    setSummary(null)
    setUploading(true)
    setCalCount(null)
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
    if (useCal && calReady === 0) {
      setError(v.calMissing)
      return
    }
    try {
      await startRun({ expect_images: expImages, ...(expAreas ? { expect_areas: expAreas } : {}), ...(useCal ? { use_calibration: true } : {}) })
      setStatus((s) => (s ? { ...s, state: 'running', log: [], verdict: null, validator: null } : s))
      setPolling(true)
    } catch (e) {
      fail(e, v.runFailed)
    }
  }

  const photos = upload?.count ?? status?.photos ?? 0
  const autoAreas = upload?.expected_areas ?? status?.expected_areas ?? null
  const hasPhotos = photos > 0
  const verdict: Verdict | null = status?.verdict ?? null
  const finished = status?.state === 'done' || status?.state === 'error'
  const calibrated = status?.calibration?.used === true
  const canDownload = verdict === 'OK' && status?.validator?.ok === true

  return (
    <div className="mx-auto grid min-w-0 max-w-3xl grid-cols-[minmax(0,1fr)] gap-8">
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
            {photos !== expImages && <p className="text-warning">{v.countWarning(photos, expImages)}</p>}
            {autoAreas != null && !expAreas && <p className="text-fg-secondary">{v.areasAuto(autoAreas, EXPECTED_AREAS)}</p>}
          </div>
        )}
      </Step>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <label className="flex items-start gap-3 text-ui text-fg">
          <input
            type="checkbox"
            checked={useCal}
            disabled={running}
            onChange={(e) => setUseCal(e.target.checked)}
            className="mt-1 size-5 cursor-pointer"
          />
          <span className="grid gap-1">
            <span className="text-label">{v.calTitle}</span>
            <span className="text-fg-secondary">{v.calOptIn}</span>
          </span>
        </label>
        {useCal && (
          <div className="grid gap-3 rounded-lg border border-line p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useMine}
                disabled={!hasPhotos || running}
                className="h-11 cursor-pointer rounded-lg border border-line px-4 text-label text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {v.calUse}
              </button>
              <label
                className={`inline-flex h-11 items-center rounded-lg border border-line px-4 text-label text-fg ${!hasPhotos || running ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
              >
                {v.calUpload}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  disabled={!hasPhotos || running}
                  onChange={(e) => {
                    void onCalFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              {calReady > 0 && (
                <button
                  type="button"
                  onClick={clearCalibration}
                  disabled={running}
                  className="h-11 cursor-pointer rounded-lg px-4 text-ui text-fg-secondary hover:bg-surface hover:text-fg"
                >
                  {v.calClear}
                </button>
              )}
            </div>
            <p className="text-ui text-fg-secondary">{calReady > 0 ? v.calSummary(calReady) : v.calHint}</p>
            {appProducts === 0 && calReady === 0 && <p className="text-ui text-warning">{v.calEmpty}</p>}
            {!hasPhotos && <p className="text-ui text-fg-muted">{v.needPhotos}</p>}
          </div>
        )}
      </section>

      <Step title={v.step2}>
        <div className="flex flex-wrap gap-3">
          <NumberField label={v.expectImages} value={exp.images} onChange={(images) => setExp((e) => ({ ...e, images }))} disabled={running} />
          <NumberField label={v.expectAreas} value={exp.areas} placeholder={v.auto} onChange={(areas) => setExp((e) => ({ ...e, areas }))} disabled={running} />
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
          <div className="grid min-w-0 gap-1">
            <h3 className="text-label text-fg">{v.log}</h3>
            <pre
              ref={logEnd}
              className="max-h-72 min-w-0 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-fg p-3 font-mono text-meta leading-relaxed text-bg"
            >
              {status.log.join('\n')}
            </pre>
          </div>
        )}
      </Step>

      {finished && (
        <Step title={v.step3}>
          <div
            className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border-2 p-4 ${verdict === 'OK' ? 'border-success' : 'border-danger'}`}
          >
            <p className={`text-display ${verdict === 'OK' ? 'text-success' : 'text-danger'}`}>
              <span aria-hidden>{verdict === 'OK' ? '✓ ' : '! '}</span>
              {verdict ? v.verdict[verdict] : v.verdict.ERROR}
              <span
                className={`ml-3 align-middle rounded-full border px-3 py-1 text-label ${calibrated ? 'border-fg text-fg' : 'border-line text-fg-secondary'}`}
              >
                {calibrated ? v.calibrated : v.notCalibrated}
              </span>
            </p>
            {calibrated && <p className="text-ui text-fg-secondary">{v.calibratedNote(status?.calibration?.products ?? 0)}</p>}
            <p className="text-copy text-fg">{verdict ? v.advice[verdict] : v.advice.ERROR}</p>
            {status?.last_line && <p className="break-all font-mono text-meta text-fg-secondary">{status.last_line}</p>}
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
                download={calibrated ? 'final_calibrated.json' : 'final.json'}
                className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-fg px-6 text-label text-bg sm:w-fit"
              >
                {calibrated ? v.downloadCalibrated : v.download}
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
