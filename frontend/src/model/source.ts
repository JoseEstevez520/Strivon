import { buildMockState } from './mock'
import { buildRealState, type Planogram, type Predictions } from './real'
import type { StoreState } from './types'

export interface Source {
  state: StoreState
  /** The URL of a camera's photo, or null when there are no real photos. */
  photoUrl: ((camera: string, image: string) => string) | null
  /** True while what the pipeline says about each area is invented. Pages that show figures say so. */
  simulated: boolean
}

/**
 * Real photos and shelf areas when the development server can read the local data folder
 * (`STRIVON_DATA_DIR`, kept out of the repo). Invented shelves otherwise.
 */
export async function loadSource(): Promise<Source> {
  try {
    const res = await fetch('/local-data/index.json')
    if (res.ok) {
      const data = (await res.json()) as { planogram: Planogram; images: Record<string, string[]> }
      // The model's answers, when they have been made; the states are simulated without them.
      let predictions: Predictions | undefined
      try {
        const said = await fetch('/local-data/predictions.json')
        if (said.ok) predictions = (await said.json()) as Predictions
      } catch {
        // no predictions yet
      }
      return {
        state: buildRealState(data.planogram, data.images, predictions),
        photoUrl: (camera, image) => `/local-data/images/${camera}/${image}`,
        simulated: !predictions,
      }
    }
  } catch {
    // no local data
  }
  return { state: buildMockState(), photoUrl: null, simulated: true }
}
