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

const FLAG = 'strivon.source'

/** True when staff chose to look at the last validation run instead of the train/test photos. */
export function validationOn(): boolean {
  try {
    return localStorage.getItem(FLAG) === 'validation'
  } catch {
    return false
  }
}

/** Switches the app between the validation run and the usual photos, then reloads so every screen starts clean. */
export function showValidation(on: boolean, to?: string): void {
  try {
    if (on) localStorage.setItem(FLAG, 'validation')
    else localStorage.removeItem(FLAG)
  } catch {
    // storage blocked: nothing to switch
    return
  }
  if (to) window.location.hash = to
  window.location.reload()
}

/**
 * Real photos and shelf areas when the development server can read the local data folder
 * (`STRIVON_DATA_DIR`, kept out of the repo). Invented shelves otherwise.
 */
export async function loadSource(limit?: number): Promise<Source> {
  if (validationOn()) {
    try {
      const [res, said] = await Promise.all([fetch('/api/validation/index'), fetch('/api/validation/predictions')])
      if (res.ok && said.ok) {
        const data = (await res.json()) as { planogram: Planogram; images: Record<string, string[]> }
        const predictions = (await said.json()) as Predictions
        return {
          state: firstCameras(buildRealState(data.planogram, data.images, predictions), limit),
          photoUrl: (camera, image) => `/api/validation/photo/${camera}/${image}`,
          simulated: false,
        }
      }
    } catch {
      // the backend is down: fall through to the usual photos
    }
  }
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
        state: firstCameras(buildRealState(data.planogram, data.images, predictions), limit),
        photoUrl: (camera, image) => `/local-data/images/${camera}/${image}`,
        simulated: !predictions,
      }
    }
  } catch {
    // no local data
  }
  return { state: firstCameras(buildMockState(), limit), photoUrl: null, simulated: true }
}

/** Keeps only the first few cameras, so a demo can show a small store. Without a limit, the state is returned as it is. */
function firstCameras(state: StoreState, limit?: number): StoreState {
  if (!limit) return state
  const keep = new Set(Object.keys(state.images).sort().slice(0, limit))
  const only = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([camera]) => keep.has(camera)))
  return {
    images: only(state.images),
    observations: only(state.observations),
    areas: Object.fromEntries(Object.entries(state.areas).filter(([, a]) => keep.has(a.camera))),
  }
}
