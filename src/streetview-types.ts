export const StreetViewStatus = {
  OK: 'OK',
  ZERO_RESULTS: 'ZERO_RESULTS',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type StreetViewStatus = (typeof StreetViewStatus)[keyof typeof StreetViewStatus]

export class LatLng {
  constructor(
    private _lat: number,
    private _lng: number,
  ) {}

  lat() {
    return this._lat
  }

  lng() {
    return this._lng
  }

  toJSON(): LatLngLiteral {
    return { lat: this._lat, lng: this._lng }
  }
}

export type LatLngLiteral = { lat: number; lng: number }

export class Size {
  constructor(
    public width: number,
    public height: number,
  ) {}
}

export interface StreetViewLink {
  pano: string
  heading?: number
  description?: string
}

export interface StreetViewLocation {
  pano: string
  latLng: LatLng
  description?: string | null
  shortDescription?: string | null
  [key: string]: unknown
  altitude?: number | null
  country?: string | null
  region?: string | null
  locality?: string | null
  road?: string | null
  service?: unknown
}

export interface StreetViewPanoramaData {
  location: StreetViewLocation
  links: StreetViewLink[]
  tiles: {
    centerHeading: number
    tileSize: Size
    worldSize: Size
    getTileUrl: () => string
  }
  imageDate?: string
  copyright?: string
  time?: Array<{ pano: string; date: Date; [key: string]: unknown }>
}

export interface StreetViewLocationRequest {
  location?: LatLng | LatLngLiteral | { lat: number | (() => number); lng: number | (() => number) }
  pano?: string
  radius?: number
}