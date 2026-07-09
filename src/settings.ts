import { reactive } from 'vue'
import { useStorage } from '@vueuse/core'
import { getCurrentDate } from '@/composables/utils.ts'
import { applyUaGeneratorProfile } from '@/composables/uaProfile'
import type { UaProfileTier } from '@/composables/uaProfile'

const { currentYear, currentDate } = getCurrentDate()

export type MapTheme = 'classic' | 'dark'

const defaultSettings = {
  mapTheme: 'classic' as MapTheme,

  coverage: {
    opacity: 1,
  },

  panoId: 'enable',
  tag: true,

  numOfGenerators: 10,
  speed: 1000,
  radius: 500,
  strategy: 'random',
  oneCountryAtATime: false,
  findRegions: false,
  regionRadius: 100,

  rejectDateless: true,
  /** 按采集日筛选（可与发布日同时开启） */
  filterCaptureDate: true,
  /** 按发布日筛选（可与采集日同时开启） */
  filterPublishDate: false,
  rejectNoDescription: true,
  rejectRoadName: false,
  searchInDescription: {
    enabled: false,
    searchTerms: '',
    searchMode: 'contains',
    filterType: 'include',
  } as SearchInDescriptionConfig,
  onlyOneInTimeframe: false,
  checkLinks: false,
  linksDepth: 2,

  captureFromDate: '2009-01',
  captureToDate: currentDate,
  publishFromDate: '2009-01',
  publishToDate: currentDate,
  fromMonth: '01',
  toMonth: '12',
  fromYear: '2007',
  toYear: currentYear,
  selectMonths: false,
  checkAllDates: false,
  randomInTimeline: false,

  filterByMinutes: {
    enabled: false,
    range: [0, 1439],
  },

  filterByLinksLength: {
    enabled: false,
    range: [1, 5],
  },

  filterByAltitude: {
    enabled: false,
    range: [0, 1000],
  },

  getCurve: false,
  minCurveAngle: 10,

  heading: {
    adjust: true,
    reference: 'link',
    range: [0, 0],
    randomInRange: false,
  },
  pitch: {
    adjust: false,
    range: [0, 0],
    randomInRange: false,
  },
  fov: {
    adjust: false,
    range: [90, 90],
    randomInRange: false,
  },
  markers: {
    gen4: true,
    newRoad: true,
    cluster: false,
    glify: true,
  },
  markersOnImport: true,
  checkImports: false,
  useUpdateTypeIconsOnImport: false,
  importedMarkersOpacity: 1.0,

  autoUaTune: true,
  uaProfileTier: null as UaProfileTier | null,
  uaProfileLabel: null as string | null,
}

const CURRENT_KEYS = Object.keys(localStorage)
const CURRENT_KEY = 'map_generator__settings_v13'

CURRENT_KEYS.forEach((key: string) => {
  if (
    key !== CURRENT_KEY &&
    localStorage.getItem(key) !== null &&
    key.startsWith('map_generator__settings_')
  ) {
    localStorage.removeItem(key)
  }
})
const storedSettings = useStorage(CURRENT_KEY, defaultSettings)
const settings = reactive(storedSettings.value)
settings.toYear = currentYear

if (settings.mapTheme !== 'classic' && settings.mapTheme !== 'dark') {
  settings.mapTheme = 'classic'
}

// 从旧版 dateSource 迁移
const legacyDateSource = (settings as { dateSource?: string }).dateSource
if (legacyDateSource === 'publish') {
  settings.filterCaptureDate = false
  settings.filterPublishDate = true
} else if (legacyDateSource === 'capture') {
  if (typeof settings.filterCaptureDate !== 'boolean') settings.filterCaptureDate = true
  if (typeof settings.filterPublishDate !== 'boolean') settings.filterPublishDate = false
}
delete (settings as { dateSource?: string }).dateSource
if (typeof settings.filterCaptureDate !== 'boolean') settings.filterCaptureDate = true
if (typeof settings.filterPublishDate !== 'boolean') settings.filterPublishDate = false

// 从共享 fromDate/toDate 拆成采集/发布两套区间
const legacy = settings as {
  fromDate?: string
  toDate?: string
  captureFromDate?: string
  captureToDate?: string
  publishFromDate?: string
  publishToDate?: string
}
const legacyFrom = legacy.fromDate ?? '2009-01'
const legacyTo = legacy.toDate ?? currentDate
if (typeof settings.captureFromDate !== 'string') settings.captureFromDate = legacyFrom
if (typeof settings.captureToDate !== 'string') settings.captureToDate = legacyTo
if (typeof settings.publishFromDate !== 'string') settings.publishFromDate = legacyFrom
if (typeof settings.publishToDate !== 'string') settings.publishToDate = legacyTo
delete legacy.fromDate
delete legacy.toDate
settings.captureToDate = currentDate
settings.publishToDate = currentDate

if (settings.autoUaTune !== false) {
  applyUaGeneratorProfile(settings)
}

export { settings }