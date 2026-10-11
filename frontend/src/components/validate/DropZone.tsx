import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { fromDrop, fromInput, type PickedFile } from '@/lib/validation'

const pickBtn =
  'inline-flex h-11 cursor-pointer items-center rounded-lg border border-line bg-raised px-4 text-label text-fg transition-colors hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-50'

export function DropZone({ disabled, onPick }: { disabled: boolean; onPick: (files: PickedFile[]) => void }) {
  const { t } = useI18n()
  const folder = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (picked: PickedFile[]) => {
    if (picked.length > 0) onPick(picked)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setOver(false)
        if (!disabled) take(await fromDrop(e.dataTransfer))
      }}
      className={`grid justify-items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
        over ? 'border-fg bg-sunk' : 'border-line bg-surface'
      }`}
    >
      <p className="text-copy text-fg">{t.validate.dropHere}</p>
      <p className="text-ui text-fg-secondary">{t.validate.dropOr}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={disabled} className={pickBtn} onClick={() => folder.current?.click()}>
          {t.validate.pickFolder}
        </button>
        <button type="button" disabled={disabled} className={pickBtn} onClick={() => files.current?.click()}>
          {t.validate.pickFiles}
        </button>
      </div>
      <input
        ref={folder}
        type="file"
        className="hidden"
        // @ts-expect-error webkitdirectory is not in the React types
        webkitdirectory=""
        multiple
        onChange={(e) => {
          take(fromInput(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        ref={files}
        type="file"
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => {
          take(fromInput(e.target.files))
          e.target.value = ''
        }}
      />
    </div>
  )
}
