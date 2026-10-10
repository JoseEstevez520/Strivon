import { FAMILY_ICON, ICON_BODY } from '@/model/produceIcons'

/** The icon of a product family, in the current text colour. Without one it shows the first letter. */
export function ProductIcon({ family, label, className = 'size-6' }: { family: string; label?: string; className?: string }) {
  const body = ICON_BODY[FAMILY_ICON[family]]
  if (!body) {
    return (
      <span className={`${className} grid place-items-center text-label`} aria-hidden>
        {(label ?? family).charAt(0).toUpperCase()}
      </span>
    )
  }
  return <svg viewBox="0 0 32 32" aria-hidden className={className} dangerouslySetInnerHTML={{ __html: body }} />
}
