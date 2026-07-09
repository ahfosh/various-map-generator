import type { StreetViewLink, StreetViewPanoramaData } from '@/streetview-types'
import { randomInRange } from '@/composables/utils'

interface BaiduRoadPano {
  PID: string
  DIR?: number
}

interface BaiduRoad {
  Name?: string
  IsCurrent?: number
  Panos?: BaiduRoadPano[] | null
}

interface BaiduLink {
  PID: string
  DIR?: number
}

export interface BaiduSdataResult {
  ID: string
  X: number
  Y: number
  Z?: number
  Rname?: string
  Heading?: number
  Pitch?: number
  /** 采集日期，YYYYMMDD，如 "20240516" */
  Date?: string
  /** 采集月份，YYYYMM */
  Time?: string
  /**
   * 处理/上线日期（街景发布时间），YYYYMMDD，如 "20260618"。
   * 与 Date（拍摄日）不同：同一采集可在之后才入库发布。
   */
  procdate?: string
  Links?: BaiduLink[]
  Roads?: BaiduRoad[]
  TimeLine?: Array<{
    ID: string
    IsCurrent?: number
    Time?: string
    TimeLine?: string
    Year?: string
  }>
}

/** 将百度紧凑日期转为 YYYY-MM-DD（支持 YYYYMMDD / YYYYMM / 已有 ISO 前缀） */
export function parseBaiduCompactDate(value?: string | null): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  if (!s) return undefined
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  if (/^\d{6}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-01`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10)
  }
  if (/^\d{4}-\d{2}/.test(s)) {
    return `${s.slice(0, 7)}-01`
  }
  return undefined
}

/** 将 YYYY-MM-DD 规范为可 Date.parse 的本地日开始时间串 */
export function toFilterDateTime(ymdOrIso?: string | null): string | undefined {
  if (!ymdOrIso) return undefined
  const s = String(ymdOrIso).trim()
  if (!s) return undefined
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s
  const ymd = parseBaiduCompactDate(s) ?? ( /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined )
  return ymd ? `${ymd}T00:00:00` : s
}

/**
 * 生成/筛选用的有效日期。
 * - capture：采集日（imageDate / API Date / panoId）
 * - publish：发布日（procdate）
 */
export function getEffectivePanoramaDate(
  pano: { imageDate?: string; procDate?: string },
  dateSource: 'capture' | 'publish' = 'capture',
): string | undefined {
  if (dateSource === 'publish') {
    return toFilterDateTime(pano.procDate) ?? undefined
  }
  return toFilterDateTime(pano.imageDate) ?? undefined
}

export interface PanoramaViewSettings {
  heading: {
    adjust: boolean
    reference: 'link' | 'forward' | 'backward'
    range: [number, number]
    randomInRange: boolean
  }
  pitch: {
    adjust: boolean
    range: [number, number]
    randomInRange: boolean
  }
  fov: {
    adjust: boolean
    range: [number, number]
    randomInRange: boolean
  }
}

export const BAIDU_UPDATE_TYPES = {
  newRoad: 'baidu_new',
  update: 'baidu_update',
} as const

const LEGACY_UPDATE_TYPES: Record<string, string> = {
  newroad: BAIDU_UPDATE_TYPES.newRoad,
  gen4update: BAIDU_UPDATE_TYPES.update,
}

export function parseBaiduLinks(result: BaiduSdataResult, currentPanoId: string): StreetViewLink[] {
  if (result.Links?.length) {
    return result.Links.map((link) => ({
      pano: link.PID,
      heading: link.DIR ?? 0,
    }))
  }

  const links: StreetViewLink[] = []
  const seen = new Set<string>()

  for (const road of result.Roads ?? []) {
    if (!road.Panos) continue
    for (const pano of road.Panos) {
      if (!pano.PID || pano.PID === currentPanoId || seen.has(pano.PID)) continue
      seen.add(pano.PID)
      links.push({
        pano: pano.PID,
        heading: pano.DIR ?? 0,
      })
    }
  }

  return links
}

export function getBaiduRoadName(result: BaiduSdataResult): string | undefined {
  if (result.Rname?.trim()) return result.Rname.trim()
  const currentRoad = result.Roads?.find((road) => road.IsCurrent === 1)
  return currentRoad?.Name?.trim() || undefined
}

export function mapLegacyZoomToFov(zoom: number): number {
  return Math.max(10, Math.min(120, 90 - zoom * 12.5))
}

export function normalizeImportedPanorama(location: Panorama): Panorama {
  const normalized = { ...location }
  if (normalized.fov == null && normalized.zoom != null) {
    normalized.fov = mapLegacyZoomToFov(Number(normalized.zoom))
  }
  if (normalized.update_type) {
    normalized.update_type = LEGACY_UPDATE_TYPES[normalized.update_type] ?? normalized.update_type
  }
  return normalized
}

export function normalizeUpdateType(updateType?: string): string | undefined {
  if (!updateType) return undefined
  return LEGACY_UPDATE_TYPES[updateType] ?? updateType
}

export function buildPanoramaView(
  pano: StreetViewPanoramaData,
  viewSettings: PanoramaViewSettings,
) {
  const defaultPitch = typeof pano.location.pitch === 'number' ? pano.location.pitch : 0

  let heading = pano.tiles.centerHeading
  if (viewSettings.heading.adjust) {
    if (viewSettings.heading.reference === 'forward') {
      heading = pano.tiles.centerHeading
    } else if (viewSettings.heading.reference === 'backward') {
      heading = (pano.tiles.centerHeading + 180) % 360
    } else if (viewSettings.heading.reference === 'link') {
      heading = pano.links[0]?.heading ?? pano.tiles.centerHeading
    }

    if (viewSettings.heading.randomInRange) {
      heading += randomInRange(viewSettings.heading.range[0], viewSettings.heading.range[1])
    } else {
      heading += Math.random() < 0.5 ? viewSettings.heading.range[0] : viewSettings.heading.range[1]
    }
    heading = ((heading % 360) + 360) % 360
  }

  let pitch = defaultPitch
  if (viewSettings.pitch.adjust) {
    pitch = viewSettings.pitch.randomInRange
      ? randomInRange(viewSettings.pitch.range[0], viewSettings.pitch.range[1])
      : Math.random() < 0.5
        ? viewSettings.pitch.range[0]
        : viewSettings.pitch.range[1]
  }

  let fov = 90
  if (viewSettings.fov.adjust) {
    fov = viewSettings.fov.randomInRange
      ? randomInRange(viewSettings.fov.range[0], viewSettings.fov.range[1])
      : Math.random() < 0.5
        ? viewSettings.fov.range[0]
        : viewSettings.fov.range[1]
  }

  return { heading, pitch, fov }
}

export function buildPanoramaRecord(
  pano: StreetViewPanoramaData,
  viewSettings: PanoramaViewSettings,
): Panorama {
  const { heading, pitch, fov } = buildPanoramaView(pano, viewSettings)

  return {
    panoId: pano.location.pano,
    lat: pano.location.latLng.lat(),
    lng: pano.location.latLng.lng(),
    heading,
    pitch,
    fov,
    country: pano.location.country ?? undefined,
    region: pano.location.region ?? undefined,
    locality: pano.location.locality ?? undefined,
    road: pano.location.road ?? undefined,
    imageDate: pano.imageDate,
    procDate: pano.procDate,
    source: 'baidu_pano',
    links: [
      ...new Set(
        pano.links.map((loc) => loc.pano).concat((pano.time ?? []).map((loc) => loc.pano)),
      ),
    ].sort(),
    extra: {
      tags: ['baidu'],
    },
  }
}