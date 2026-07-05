/// <reference types="vite/client" />
/// <reference types="leaflet-draw" />

type LatLng = {
  lat: number
  lng: number
}

interface Feature extends GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  properties: {
    code: string
    name: string
    country: string
    [key: string]: string
  }
}

interface Polygon extends L.Polygon {
  _leaflet_id: number
  feature: Feature
  isProcessing: boolean
  nbNeeded: number
  found: Panorama[]
  checkedPanos: Set<string>
}

interface Panorama {
  panoId: any
  lat: LatLng.lat
  lng: LatLng.lng
  heading: number
  pitch: number
  fov: number
  /** @deprecated 旧版 Google 街景导出字段，导入时自动转换为 fov */
  zoom?: number
  country?: string
  region?: string
  locality?: string
  road?: string
  altitude?: number
  imageDate?: string
  source?: string
  update_type?: string
  link?: string
  links?: string[]
  extra?: {
    tags: string[]
  }
}

interface SearchInDescriptionConfig {
  enabled: boolean
  searchTerms: string
  searchMode: 'fullword' | 'startswith' | 'endswith' | 'contains' | 'sectionmatch'
  filterType: 'include' | 'exclude'
}
