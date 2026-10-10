import { FAMILIES } from './families'
import { hash, simulateObservations } from './simulate'
import type { Area, StoreState } from './types'

const PRODUCTS = Object.keys(FAMILIES).filter((k) => k !== 'other')

// Invented ids with the real section's size: 14 cameras and about 150 shelf areas.
const CAMERAS = ['6215', '6218', '6376', '6383', '6402', '6419', '6441', '6462', '6468', '6471', '6473', '6476', '6480', '6483']
const AREAS_PER_CAMERA = [8, 10, 12, 9, 11, 13, 10, 12, 11, 9, 10, 12, 11, 14]
const FRAMES = 13

// Lisbon is UTC+1 on the day of the challenge.
const at = (hour: number, minute: number) => Date.UTC(2026, 9, 10, hour - 1, minute) / 1000

function quad(col: number, row: number, cols: number): [number, number][] {
  const w = 1100 / cols
  const x = 90 + col * w
  const y = 90 + row * 300
  return [
    [x + 14, y],
    [x + w - 24, y],
    [x + w - 14, y + 240],
    [x, y + 240],
  ]
}

/**
 * Invented shelves with the size of the real store, for when the local data is not there. A
 * camera sees three products, and neighbouring cameras share one, so the same product turns up
 * in several places.
 */
export function buildMockState(): StoreState {
  const state: StoreState = { images: {}, areas: {}, observations: {} }

  CAMERAS.forEach((camera, c) => {
    const count = AREAS_PER_CAMERA[c]
    const cols = Math.ceil(count / 2)
    const products = [0, 1, 2].map((j) => PRODUCTS[(c * 2 + j) % PRODUCTS.length])

    state.images[camera] = Array.from({ length: FRAMES }, (_, k) => {
      const minutes = 8 * 60 + k * 55 + Math.floor(hash(c) * 20)
      const ts = at(Math.floor(minutes / 60), minutes % 60)
      return { image: `${ts}.jpg`, ts }
    })

    for (let i = 0; i < count; i++) {
      const family = products[Math.floor((i * 3) / count)]
      const area: Area = {
        area_id: `${camera}_${i + 1}`,
        camera,
        index: i + 1,
        quad: quad(i % cols, Math.floor(i / cols), cols),
        family,
        product_id: family,
      }
      state.areas[area.area_id] = area
    }
  })

  simulateObservations(state)
  return state
}
