import { familyOf } from './catalog'
import { simulateObservations } from './simulate'
import type { StoreState } from './types'

type Corner = [number, number]

export interface Planogram {
  'Frutas e Legumes': {
    cameras: Record<
      string,
      {
        products: {
          area_id: string
          product_id: string
          product_name: string
          image_coordinates: { top_left: Corner; top_right: Corner; bottom_right: Corner; bottom_left: Corner }
        }[]
      }
    >
  }
}

/**
 * The real cameras, photos and shelf areas, read from the planogram and the photo names (which
 * are their Unix timestamps). What the pipeline says about each area is simulated for now.
 */
export function buildRealState(planogram: Planogram, photos: Record<string, string[]>): StoreState {
  const state: StoreState = { images: {}, areas: {}, observations: {} }

  for (const [camera, entry] of Object.entries(planogram['Frutas e Legumes'].cameras)) {
    const files = photos[camera]
    if (!files?.length) continue
    state.images[camera] = files
      .map((image) => ({ image, ts: Number.parseInt(image, 10) }))
      .sort((a, b) => a.ts - b.ts)

    for (const p of entry.products) {
      const c = p.image_coordinates
      state.areas[p.area_id] = {
        area_id: p.area_id,
        camera,
        index: Number.parseInt(p.area_id.split('_')[1] ?? '0', 10),
        quad: [c.top_left, c.top_right, c.bottom_right, c.bottom_left],
        family: familyOf(p.product_name),
        product_id: p.product_id,
      }
    }
  }

  simulateObservations(state)
  return state
}
