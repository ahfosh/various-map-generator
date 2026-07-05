import { reactive } from 'vue'
import { useStorage } from '@vueuse/core'
import { getCurrentDate } from '@/composables/utils.ts'

const { currentYear, currentDate } = getCurrentDate()

const defaultSettings = {
  mapTheme: 'default',

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

  fromDate: '2009-01',
  toDate: currentDate,
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
}

const CURRENT_KEYS = Object.keys(localStorage)
const CURRENT_KEY = 'map_generator__settings_v12'

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
settings.toDate = currentDate
settings.toYear = currentYear

export { settings }