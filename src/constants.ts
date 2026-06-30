export const PETAL_MAPS_TEMPLATE = {
  Light:
    'https://maprastertile-drcn.dbankcdn.cn/display-service/v1/online-render/getTile/24.12.10.10/{z}/{x}/{y}/?language=en&p=46&scale=2&mapType=ROADMAP&presetStyleId=standard&pattern=JPG&key=DAEDANitav6P7Q0lWzCzKkLErbrJG4kS1u%2FCpEe5ZyxW5u0nSkb40bJ%2BYAugRN03fhf0BszLS1rCrzAogRHDZkxaMrloaHPQGO6LNg==',
  Dark:
    'https://maprastertile-drcn.dbankcdn.cn/display-service/v1/online-render/getTile/25.07.19.40.300/{z}/{x}/{y}/?language=en&p=46&scale=2&mapType=ROADMAP&presetStyleId=night&pattern=JPG&key=DAEDANitav6P7Q0lWzCzKkLErbrJG4kS1u%2FCpEe5ZyxW5u0nSkb40bJ%2BYAugRN03fhf0BszLS1rCrzAogRHDZkxaMrloaHPQGO6LNg==',
}

export const CHINA_CENTER: [number, number] = [35.86, 104.19]

export const CHINA_BBOX = {
  west: 72.004,
  east: 137.8347,
  south: 0.8293,
  north: 55.8271,
} as const

export const CHINA_COUNTRY_CODES = new Set(['cn', 'tw', 'hk', 'mo'])

export const countryCodeMap: Record<string, string> = {
  cn: 'CHN',
}

export function isInChina(lng: number, lat: number): boolean {
  return (
    lng >= CHINA_BBOX.west &&
    lng <= CHINA_BBOX.east &&
    lat >= CHINA_BBOX.south &&
    lat <= CHINA_BBOX.north
  )
}

export function normalizeChinaCountryCode(code?: string): string | null {
  if (!code) return null
  const lower = code.toLowerCase()
  if (CHINA_COUNTRY_CODES.has(lower)) return 'cn'
  return null
}