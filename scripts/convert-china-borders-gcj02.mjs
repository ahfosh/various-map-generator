/**
 * Convert public/geojson/china_borders.json from WGS84 to GCJ-02.
 * Map display (Petal Maps + Baidu pano markers) and Baidu coverage tiles
 * all use GCJ-02 in this project.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import gcoord from 'gcoord'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(__dirname, '../public/geojson/china_borders.json')

const data = JSON.parse(fs.readFileSync(target, 'utf8'))

function convertCoords(coords) {
  if (typeof coords[0] === 'number') {
    const [lng, lat, ...rest] = coords
    const [nlng, nlat] = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.GCJ02)
    return rest.length ? [nlng, nlat, ...rest] : [nlng, nlat]
  }
  return coords.map(convertCoords)
}

function convertGeometry(geom) {
  if (!geom) return geom
  if (geom.type === 'GeometryCollection') {
    return { ...geom, geometries: geom.geometries.map(convertGeometry) }
  }
  if (geom.coordinates) {
    return { ...geom, coordinates: convertCoords(geom.coordinates) }
  }
  return geom
}

const out = {
  ...data,
  features: data.features.map((f) => ({
    ...f,
    geometry: convertGeometry(f.geometry),
  })),
}

const sampleBefore =
  data.features[0].geometry.type === 'Polygon'
    ? data.features[0].geometry.coordinates[0][0]
    : data.features[0].geometry.coordinates[0][0][0]
const sampleAfter =
  out.features[0].geometry.type === 'Polygon'
    ? out.features[0].geometry.coordinates[0][0]
    : out.features[0].geometry.coordinates[0][0][0]

let pointCount = 0
function countPoints(c) {
  if (typeof c[0] === 'number') pointCount++
  else c.forEach(countPoints)
}
out.features.forEach((f) => countPoints(f.geometry.coordinates))

const lines = ['{"type":"FeatureCollection", "features": [']
for (let i = 0; i < out.features.length; i++) {
  const comma = i < out.features.length - 1 ? ',' : ''
  lines.push(JSON.stringify(out.features[i]) + comma)
}
lines.push(']}')
fs.writeFileSync(target, lines.join('\n') + '\n')

console.log('sample before (WGS84):', sampleBefore)
console.log('sample after  (GCJ02):', sampleAfter)
console.log('delta lng/lat:', [sampleAfter[0] - sampleBefore[0], sampleAfter[1] - sampleBefore[1]])
console.log('features:', out.features.length)
console.log('points converted:', pointCount)
console.log('written:', target, 'bytes:', fs.statSync(target).size)
