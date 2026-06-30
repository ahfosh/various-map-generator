import { reactive } from 'vue'
import { useStorage } from '@vueuse/core'
import { getCurrentDate } from '@/composables/utils.ts'

const { currentYear, currentDate } = getCurrentDate()

const defaultSettings = {
  notification: {
    enabled: false,
    anyLocation: false,
    onePolygonComplete: false,
    allPolygonsComplete: false,
  },

  mapTheme: 'default',

  scheduled: {
    enabled: false,
    last: 1,
    after: 1,
    interval: 1,
  },

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

  provider: 'baidu',

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

  findByTileColor: {
    enabled: false,
    zoom: 19,
    filterType: 'include',
    operator: 'OR',
    tileProvider: 'gmaps',
    tileColors: {
      gmaps: [
        {
          label: '道路、街道',
          active: false,
          threshold: 0.05,
          colors: ['170,185,201', '193,204,216', '186,201,215'],
        },
      ],
      osm: [
        { label: '白色道路', active: false, threshold: 0.05, colors: ['255,255,255'] },
      ],
    },
  } as TileColorConfig,

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
  zoom: {
    adjust: false,
    range: [0, 0],
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
const CURRENT_KEY = 'map_generator__settings_v11'

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