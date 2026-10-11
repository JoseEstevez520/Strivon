import { familyOf } from './catalog'
import { simulateObservations } from './simulate'
import type { Level, Observation, StoreState } from './types'

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

/** What the pipeline writes: camera, then photo, then area. Other fields of an area are ignored. */
/** The finest fill the pipeline gives: the raw fill, else the expected value of p_stock, else the plain value. */
function fillOf(o: { stock_value?: number; fill_raw?: number; p_stock?: number[] }): number | undefined {
  if (o.fill_raw !== undefined) return o.fill_raw
  if (o.p_stock?.length === 3) return o.p_stock[1] * 0.5 + o.p_stock[2]
  return o.stock_value
}

export type Predictions = Record<string, Record<string, Record<string, { planogram_compliant: boolean; stock_level: Level; stock_value?: number; fill_raw?: number; p_stock?: number[] }>>>

/**
 * The real cameras, photos and shelf areas, read from the planogram and the photo names (which
 * are their Unix timestamps). What the pipeline says about each area comes from `predictions` when
 * there are any, and is simulated otherwise. A photo the predictions do not cover is left out, so
 * nothing on screen mixes real and invented states.
 */
export function buildRealState(planogram: Planogram, photos: Record<string, string[]>, predictions?: Predictions): StoreState {
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
        // Cards and the products page show the family name, so they group by family. Two catalogue
        // ids of one family (two kinds of red apple) are one product on screen.
        product_id: familyOf(p.product_name),
      }
    }
  }

  if (!predictions) {
    simulateObservations(state)
    return state
  }
  for (const camera of Object.keys(state.images)) {
    const said = predictions[camera] ?? {}
    state.images[camera] = state.images[camera].filter((r) => said[r.image])
    if (state.images[camera].length === 0) {
      delete state.images[camera]
      continue
    }
    state.observations[camera] = {}
    for (const { image } of state.images[camera]) {
      const frame: Record<string, Observation> = {}
      for (const [area, o] of Object.entries(said[image])) {
        if (state.areas[area]) frame[area] = { planogram_compliant: o.planogram_compliant, stock_level: o.stock_level, stock_value: fillOf(o) }
      }
      state.observations[camera][image] = frame
    }
  }
  return state
}
