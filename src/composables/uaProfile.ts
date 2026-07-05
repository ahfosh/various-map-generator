import { configureGenerationConcurrency, configurePanoRequestQueue } from '@/concurrency'

export type UaProfileTier = 'mobile' | 'tablet' | 'low-end' | 'standard' | 'high-end'

export interface UaGeneratorProfile {
  tier: UaProfileTier
  label: string
  numOfGenerators: number
  speed: number
  oneCountryAtATime: boolean
  markersGlify: boolean
  markersCluster: boolean
  markersOnImport: boolean
  maxApiConcurrent: number
  initialChunkSize: number
  maxChunkSize: number
}

export interface UaRuntimeSignals {
  userAgent: string
  hardwareConcurrency: number
  deviceMemoryGb: number | null
  maxTouchPoints: number
}

const PROFILES: Record<UaProfileTier, UaGeneratorProfile> = {
  mobile: {
    tier: 'mobile',
    label: '手机',
    numOfGenerators: 1,
    speed: 100,
    oneCountryAtATime: true,
    markersGlify: false,
    markersCluster: true,
    markersOnImport: false,
    maxApiConcurrent: 12,
    initialChunkSize: 20,
    maxChunkSize: 40,
  },
  tablet: {
    tier: 'tablet',
    label: '平板',
    numOfGenerators: 3,
    speed: 250,
    oneCountryAtATime: false,
    markersGlify: false,
    markersCluster: true,
    markersOnImport: true,
    maxApiConcurrent: 20,
    initialChunkSize: 35,
    maxChunkSize: 70,
  },
  'low-end': {
    tier: 'low-end',
    label: '低配设备',
    numOfGenerators: 4,
    speed: 300,
    oneCountryAtATime: false,
    markersGlify: false,
    markersCluster: true,
    markersOnImport: true,
    maxApiConcurrent: 20,
    initialChunkSize: 40,
    maxChunkSize: 80,
  },
  standard: {
    tier: 'standard',
    label: '标准桌面',
    numOfGenerators: 6,
    speed: 500,
    oneCountryAtATime: false,
    markersGlify: true,
    markersCluster: false,
    markersOnImport: true,
    maxApiConcurrent: 30,
    initialChunkSize: 60,
    maxChunkSize: 120,
  },
  'high-end': {
    tier: 'high-end',
    label: '高性能桌面',
    numOfGenerators: 10,
    speed: 1000,
    oneCountryAtATime: false,
    markersGlify: true,
    markersCluster: false,
    markersOnImport: true,
    maxApiConcurrent: 40,
    initialChunkSize: 75,
    maxChunkSize: 150,
  },
}

export function readUaRuntimeSignals(userAgent = navigator.userAgent): UaRuntimeSignals {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    userAgent,
    hardwareConcurrency: nav.hardwareConcurrency || 4,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    maxTouchPoints: nav.maxTouchPoints || 0,
  }
}

function isTabletUa(ua: string, maxTouchPoints: number): boolean {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return true
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true
  return maxTouchPoints > 1 && /Macintosh/i.test(ua)
}

function isMobilePhoneUa(ua: string): boolean {
  return /iPhone|iPod|Windows Phone|IEMobile/i.test(ua) || /Android.*Mobile/i.test(ua)
}

function isLowEndDevice(signals: UaRuntimeSignals): boolean {
  const lowCpu = signals.hardwareConcurrency > 0 && signals.hardwareConcurrency <= 4
  const lowMemory = signals.deviceMemoryGb != null && signals.deviceMemoryGb <= 4
  return lowCpu || lowMemory
}

function isHighEndDevice(signals: UaRuntimeSignals): boolean {
  const strongCpu = signals.hardwareConcurrency >= 8
  const strongMemory = signals.deviceMemoryGb != null && signals.deviceMemoryGb >= 8
  if (signals.deviceMemoryGb == null) return strongCpu
  return strongCpu && strongMemory
}

export function detectUaGeneratorProfile(
  signals: UaRuntimeSignals = readUaRuntimeSignals(),
): UaGeneratorProfile {
  const ua = signals.userAgent

  if (isMobilePhoneUa(ua)) return { ...PROFILES.mobile }
  if (isTabletUa(ua, signals.maxTouchPoints)) return { ...PROFILES.tablet }
  if (isLowEndDevice(signals)) return { ...PROFILES['low-end'] }
  if (isHighEndDevice(signals)) return { ...PROFILES['high-end'] }
  return { ...PROFILES.standard }
}

export interface GeneratorSettingsTarget {
  numOfGenerators: number
  speed: number
  oneCountryAtATime: boolean
  markersOnImport: boolean
  markers: {
    glify: boolean
    cluster: boolean
  }
  autoUaTune?: boolean
  uaProfileTier?: UaProfileTier | null
  uaProfileLabel?: string | null
}

export function applyUaGeneratorProfile(target: GeneratorSettingsTarget): UaGeneratorProfile {
  const profile = detectUaGeneratorProfile()

  target.numOfGenerators = profile.numOfGenerators
  target.speed = profile.speed
  target.oneCountryAtATime = profile.oneCountryAtATime
  target.markersOnImport = profile.markersOnImport
  target.markers.glify = profile.markersGlify
  target.markers.cluster = profile.markersCluster
  target.uaProfileTier = profile.tier
  target.uaProfileLabel = profile.label

  configurePanoRequestQueue(profile.maxApiConcurrent)
  configureGenerationConcurrency({
    initialChunkSize: profile.initialChunkSize,
    maxChunkSize: profile.maxChunkSize,
  })

  return profile
}