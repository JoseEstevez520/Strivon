import type { Area } from '@/data/types'
import { IMAGE_SIZE } from '@/data/types'
import { useStore } from '@/lib/store'

/** A small piece of the camera photo showing one shelf area. A flat tone when there is no photo. */
export function AreaCrop({ area, image, size = 48 }: { area: Area; image: string; size?: number }) {
  const { photoUrl } = useStore()
  const src = photoUrl?.(area.camera, image)
  const xs = area.quad.map((p) => p[0])
  const ys = area.quad.map((p) => p[1])
  const x0 = Math.max(0, Math.min(...xs))
  const x1 = Math.min(IMAGE_SIZE.width, Math.max(...xs))
  const y0 = Math.max(0, Math.min(...ys))
  const y1 = Math.min(IMAGE_SIZE.height, Math.max(...ys))
  const bw = Math.max(1, x1 - x0)
  const bh = Math.max(1, y1 - y0)
  // Scale so the area covers the square, centred on it.
  const s = Math.max(size / bw, size / bh)

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md bg-[color-mix(in_oklab,var(--c,transparent)_22%,#d6d8d0)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute max-w-none"
          style={{
            width: IMAGE_SIZE.width * s,
            height: IMAGE_SIZE.height * s,
            left: size / 2 - (x0 + bw / 2) * s,
            top: size / 2 - (y0 + bh / 2) * s,
          }}
        />
      )}
      <span className="absolute inset-0 bg-[color-mix(in_oklab,var(--c,transparent)_14%,transparent)]" />
    </div>
  )
}
