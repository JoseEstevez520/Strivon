import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/lib/i18n'

/** A code that opens the round on a phone, for the desktop screen where the round is planned. */
export function PhoneCode() {
  const { t } = useI18n()
  const url = `${window.location.origin}${window.location.pathname}#/round`
  return (
    <div className="mt-4 hidden items-center gap-4 rounded-2xl bg-surface p-4 xl:flex">
      <span className="shrink-0 rounded-lg bg-raised p-2">
        <QRCodeSVG value={url} size={88} marginSize={0} title={url} />
      </span>
      <span className="min-w-0">
        <span className="block text-label">{t.openOnPhone}</span>
        <span className="block truncate text-meta text-fg-secondary">{url.replace(/^https?:\/\//, '')}</span>
      </span>
    </div>
  )
}
