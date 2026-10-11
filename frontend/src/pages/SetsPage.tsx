import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraTable } from '@/components/sets/CameraTable'
import { CompareTable } from '@/components/sets/CompareTable'
import { MixBar } from '@/components/sets/MixBar'
import { ScorePanel } from '@/components/sets/ScorePanel'
import { DropZone } from '@/components/validate/DropZone'
import { useI18n } from '@/lib/i18n'
import { deleteSet, getSet, listSets, renameSet, type SetDetail, type SetItem } from '@/lib/sets'
import { ApiError, getStatus, startRun, uploadPhotos, type PickedFile } from '@/lib/validation'

const EXPECTED_AREAS = 289
const btn =
  'inline-flex h-11 cursor-pointer items-center rounded-lg border border-line bg-raised px-4 text-label text-fg transition-colors hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-50'

const when = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '')

function useDetails(ids: string[], tick: number) {
  const [map, setMap] = useState<Record<string, SetDetail>>({})
  const key = ids.join('|')
  useEffect(() => {
    let live = true
    const want = key ? key.split('|') : []
    Promise.all(want.map((id) => getSet(id).catch(() => null))).then((all) => {
      if (!live) return
      const next: Record<string, SetDetail> = {}
      all.forEach((d) => {
        if (d) next[d.id] = d
      })
      setMap(next)
    })
    return () => {
      live = false
    }
  }, [key, tick])
  return map
}

export function SetsPage() {
  const { t } = useI18n()
  const s = t.sets
  const [sets, setSets] = useState<SetItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  const [picked, setPicked] = useState<PickedFile[]>([])
  const [name, setName] = useState('')
  const [expImages, setExpImages] = useState(26)
  const [expAreas, setExpAreas] = useState(EXPECTED_AREAS)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const logEnd = useRef<HTMLPreElement>(null)

  const fail = useCallback(
    (e: unknown, wrap?: (why: string) => string) => {
      if (e instanceof ApiError && e.kind === 'down') setError(t.validate.backendDown)
      else if (e instanceof ApiError && e.kind === 'busy') setError(t.validate.busy)
      else {
        const why = e instanceof Error ? e.message : String(e)
        setError(wrap ? wrap(why) : why)
      }
    },
    [t],
  )

  const refresh = useCallback(async () => {
    try {
      setSets(await listSets())
    } catch (e) {
      fail(e)
    }
  }, [fail])

  useEffect(() => {
    listSets()
      .then(setSets)
      .catch((e) => fail(e))
  }, [fail])

  const anyRunning = sets.some((x) => x.status === 'running')
  useEffect(() => {
    if (!anyRunning) return
    const id = setInterval(() => {
      void refresh()
      setTick((n) => n + 1)
    }, 3000)
    return () => clearInterval(id)
  }, [anyRunning, refresh])

  const defaultName = s.defaultName(sets.length + 1)
  const details = useDetails(Array.from(new Set([...(selected ? [selected] : []), ...checked])), tick)
  const detail = selected ? details[selected] : undefined

  useEffect(() => {
    logEnd.current?.scrollTo({ top: logEnd.current.scrollHeight })
  }, [progress.length])

  const onPick = (files: PickedFile[]) => {
    setPicked(files)
    setExpImages(files.length)
  }

  const uploadAndRun = async () => {
    if (picked.length === 0) return
    setError(null)
    setWorking(true)
    setProgress([])
    try {
      const up = await uploadPhotos(picked)
      await renameSet(up.session, name.trim() || defaultName)
      setProgress([s.uploadedStep(up.count)])
      setSelected(up.session)
      await refresh()
      await startRun({ expect_images: expImages, expect_areas: expAreas })
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500))
        const st = await getStatus()
        setProgress([s.uploadedStep(up.count), ...st.log.slice(-60)])
        if (st.state !== 'running') {
          if (st.verdict && st.verdict !== 'OK') setError(t.validate.verdict[st.verdict])
          break
        }
      }
      setPicked([])
      setName('')
      await refresh()
      setTick((n) => n + 1)
    } catch (e) {
      fail(e, s.runFailed)
      await refresh()
    } finally {
      setWorking(false)
    }
  }

  const rename = async (d: SetItem) => {
    const next = window.prompt(s.nameLabel, d.name)
    if (!next || !next.trim() || next.trim() === d.name) return
    try {
      await renameSet(d.id, next.trim())
      await refresh()
    } catch (e) {
      fail(e)
    }
  }

  const remove = async (d: SetItem) => {
    if (!window.confirm(s.confirmDelete(d.name))) return
    try {
      await deleteSet(d.id)
      if (selected === d.id) setSelected(null)
      setChecked((c) => c.filter((x) => x !== d.id))
      await refresh()
    } catch (e) {
      fail(e)
    }
  }

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const compared = checked.map((id) => details[id]).filter((d): d is SetDetail => !!d)

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <header className="grid gap-2">
        <h1 className="text-display">{s.title}</h1>
        <p className="text-ui text-fg-secondary">{s.intro}</p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-ui text-danger">
          {error}
        </p>
      )}

      <section className="grid gap-3">
        <DropZone disabled={working} onPick={onPick} />
        {picked.length > 0 && <p className="text-label text-fg">{t.validate.photos(picked.length)}</p>}
        <label className="grid gap-1 text-label text-fg">
          {s.nameLabel}
          <input
            type="text"
            value={name}
            placeholder={defaultName}
            maxLength={80}
            disabled={working}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-raised px-3 text-copy disabled:opacity-50"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          {[
            { label: t.validate.expectImages, value: expImages, set: setExpImages },
            { label: t.validate.expectAreas, value: expAreas, set: setExpAreas },
          ].map((f) => (
            <label key={f.label} className="grid flex-1 gap-1 text-label text-fg">
              {f.label}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={f.value}
                disabled={working}
                onChange={(e) => f.set(Math.max(1, Number(e.target.value) || 1))}
                className="h-11 w-full min-w-24 rounded-lg border border-line bg-raised px-3 text-copy tabular-nums disabled:opacity-50"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={uploadAndRun}
          disabled={working || picked.length === 0}
          className="h-12 w-full cursor-pointer rounded-lg bg-fg px-6 text-label text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:w-fit"
        >
          {working ? s.working : s.uploadRun}
        </button>
        {progress.length > 0 && (
          <pre
            ref={logEnd}
            className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-fg p-3 font-mono text-meta leading-relaxed text-bg"
          >
            {progress.join('\n')}
          </pre>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-title">{s.listTitle}</h2>
        {sets.length === 0 && <p className="text-ui text-fg-muted">{s.none}</p>}
        <ul className="grid gap-2">
          {sets.map((d) => {
            const on = d.id === selected
            return (
              <li key={d.id} className={`flex items-start gap-3 rounded-xl border p-3 ${on ? 'border-fg bg-surface' : 'border-line bg-raised'}`}>
                <input
                  type="checkbox"
                  aria-label={`${s.compareSelect}: ${d.name}`}
                  checked={checked.includes(d.id)}
                  onChange={() => toggle(d.id)}
                  className="mt-1 size-5 shrink-0 cursor-pointer"
                />
                <button type="button" onClick={() => setSelected(on ? null : d.id)} className="grid min-w-0 flex-1 cursor-pointer gap-0.5 text-left">
                  <span className="truncate text-label text-fg">{d.name}</span>
                  <span className="text-meta text-fg-muted">{when(d.created)}</span>
                  <span className="text-ui text-fg-secondary tabular-nums">
                    {s.photos(d.photos)} · {s.areas(d.areas)}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-ui">
                    <span className={d.status === 'done' ? 'text-success' : d.status === 'failed' ? 'text-danger' : 'text-warning'}>
                      {s.status[d.status]}
                      {d.verdict && d.verdict !== 'OK' ? ` (${d.verdict})` : ''}
                    </span>
                    <span className={d.has_labels ? 'text-fg' : 'text-fg-muted'}>{d.has_labels ? s.labelled : s.unlabelled}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {selected && (
        <section className="grid gap-5 rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="min-w-0 break-words text-title">{detail?.name ?? selected}</h2>
            <div className="flex flex-wrap gap-2">
              {detail && (
                <>
                  <button type="button" className={btn} onClick={() => rename(detail)}>
                    {s.rename}
                  </button>
                  <button type="button" className={btn} onClick={() => remove(detail)}>
                    {s.delete}
                  </button>
                </>
              )}
              <button type="button" className={btn} onClick={() => setSelected(null)}>
                {s.close}
              </button>
            </div>
          </div>
          {detail?.totals ? (
            <>
              <div className="grid gap-2">
                <h3 className="text-label text-fg">{s.stockMix}</h3>
                <MixBar mix={detail.totals} />
                <p className="text-ui tabular-nums">{s.notCompliantPct(String(detail.totals.not_compliant_pct))}</p>
              </div>
              <CameraTable cameras={detail.cameras} totals={detail.totals} score={detail.score} />
            </>
          ) : (
            detail && <p className="text-ui text-danger">{s.status[detail.status]}</p>
          )}
          {detail && <ScorePanel set={detail} onChanged={() => {
              setTick((n) => n + 1)
              void refresh()
            }} />}
        </section>
      )}

      <section className="grid gap-3">
        {compared.length >= 2 ? <CompareTable sets={compared} /> : <p className="text-ui text-fg-muted">{s.compareHint}</p>}
      </section>
    </div>
  )
}
