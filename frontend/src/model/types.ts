// Same shape as the pipeline's /api/state, so the simulated data can be swapped for the real one.
export type Level = 'empty' | 'half' | 'full'

export interface Area {
  area_id: string
  camera: string
  index: number
  /** Four corners in the camera image, which is 1280x720. */
  quad: [number, number][]
  family: string
  product_id: string
  /** The planogram's own product id and name, when the areas come from the real planogram. */
  catalog_id?: string
  product_name?: string
}

export interface Observation {
  planogram_compliant: boolean
  stock_level: Level
  observed_family?: string
  /** How full the area is, 0 to 1, when the pipeline says so. The app turns it into a level per product. */
  stock_value?: number
}

export interface ImageRecord {
  image: string
  /** Unix seconds. */
  ts: number
}

export interface StoreState {
  images: Record<string, ImageRecord[]>
  areas: Record<string, Area>
  observations: Record<string, Record<string, Record<string, Observation>>>
}

export const IMAGE_SIZE = { width: 1280, height: 720 }
