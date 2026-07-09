import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/assets/leaflet-draw/leaflet.draw.js' // npm one is broken for rectangles so we use a patched one
import '@/assets/leaflet-draw/leaflet.draw.css'
import { applyLeafletDrawZh } from '@/i18n/leafletDrawZh'
applyLeafletDrawZh()
import 'leaflet.markercluster'
import 'leaflet.markercluster.freezable/dist/leaflet.markercluster.freezable.js'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet-contextmenu'
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css'
import 'leaflet.glify'

import markerBlue from '@/assets/markers/marker-blue.png'
import markerRed from '@/assets/markers/marker-red.png'

import { ref } from 'vue'
import { settings } from '@/settings'
import {
  isValidGeoJSON,
  getPolygonName,
  readFileAsText,
  resetPolygonSearchState,
} from '@/composables/utils.ts'
import { BaiduLayer } from './layers/baiduLayer'
import { CHINA_BBOX, CHINA_CENTER, PETAL_MAPS_TEMPLATE } from './constants'
import type { MapTheme } from './settings'

import { useStore } from '@/store'
const { selected, select, state } = useStore()

let map: L.Map
const currentZoom = ref(1)

const petalMapsLayer = L.tileLayer(PETAL_MAPS_TEMPLATE[settings.mapTheme])

const baiduCoverageLayer = new BaiduLayer({ filter: 'hue-rotate(140deg) saturate(200%)' })

const overlayMaps = {
  '百度街景（需要缩放级别 5 以上）': baiduCoverageLayer,
}

const allLayers = [petalMapsLayer, ...Object.values(overlayMaps)]

class PolygonHole extends L.Draw.Polygon {
  type: string = 'polygonHole';

  constructor(map: L.DrawMap, options: L.DrawOptions.PolygonOptions = {}) {
    super(map, options);
  }
}

(L.Draw as any).PolygonHole = PolygonHole;

L.Control.Draw.mergeOptions({
  draw: {
    polygonHole: {
      iconClass: 'leaflet-draw-draw-polygon-hole',
    },
  },
});

L.DrawToolbar.include({
  getModeHandlers: function (map: L.DrawMap) {
    return [
      {
        enabled: this.options.polygon !== false,
        handler: new L.Draw.Polygon(map, this.options.polygon),
        title: '绘制多边形',
      },
      {
        enabled: this.options.rectangle !== false,
        handler: new L.Draw.Rectangle(map, this.options.rectangle),
        title: '绘制矩形',
      },
      {
        enabled: this.options.polygonHole !== false,
        handler: new (L.Draw as any).PolygonHole(map, this.options.polygonHole),
        title: '绘制多边形孔洞',
      },
    ];
  },
});

const drawnPolygonsLayer = new L.GeoJSON()

const drawControl = new L.Control.Draw({
  position: 'bottomleft',
  draw: {
    polyline: false,
    marker: false,
    circlemarker: false,
    circle: false,
    polygon: {
      allowIntersection: false,
      drawError: {
        color: '#e1e100',
        message:
          '<strong>多边形绘制不允许交叉！<strong>（allowIntersection: false）',
      },
      shapeOptions: { color: '#5d8ce3' },
    },
    rectangle: { shapeOptions: { color: '#5d8ce3' } },
  },
  edit: { featureGroup: drawnPolygonsLayer },
})

async function initMap(el: string) {
  if (map) return map

  map = L.map(el, {
    attributionControl: false,
    contextmenu: true,
    contextmenuItems: [
      { text: '复制坐标', callback: copyCoords },
      { text: '查看最近全景图', callback: openNearestPano },
    ],
    center: CHINA_CENTER,
    preferCanvas: true,
    zoom: 4,
    minZoom: 3,
    maxZoom: 19,
    zoomControl: false,
    maxBounds: [
      [CHINA_BBOX.south, CHINA_BBOX.west],
      [CHINA_BBOX.north, CHINA_BBOX.east],
    ],
    maxBoundsViscosity: 0.85,
  })

  map.createPane('labelPane')
  map.createPane('panoramasPane')
  map.getPane('labelPane')!.style.zIndex = '300';
  map.getPane("panoramasPane")!.style.zIndex = '500';

  petalMapsLayer.addTo(map)
  baiduCoverageLayer.addTo(map)

  for (const layer of availableLayers.value) {
    if (layer.visible) {
      const loaded = await loadLayer(layer as LayerMeta)
      map.addLayer(loaded)
    }
  }

  Object.entries(markerLayers).forEach(([key]) => {
    updateMarkerLayers(key as MarkerLayersTypes)
  })

  map.addControl(drawControl)

  map.on('draw:created', (e) => {
    const event = e as L.DrawEvents.Created
    if (event.layerType === "polygonHole") {
      const holeLayer = event.layer as L.Polygon;
      const holeLatLngs = holeLayer.getLatLngs()[0];

      const target = selected.value[selected.value.length - 1];

      if (target) {
        const currentLatLngs = target.getLatLngs() as L.LatLng[][];

        if (Array.isArray(holeLatLngs)) {
          currentLatLngs.push(holeLatLngs as L.LatLng[]);
          target.setLatLngs(currentLatLngs);
          map.removeLayer(holeLayer);

          const updatedGeoJSON = target.toGeoJSON();
          target.feature = updatedGeoJSON;

          const index = selected.value.findIndex((x) => x._leaflet_id === target._leaflet_id);
          if (index !== -1) {
            selected.value[index] = target;
          }
          drawnPolygonsLayer.removeLayer(target as any);
          drawnPolygonsLayer.addLayer(target as any);
        }
      }
      return;
    }
    const polygon = event.layer as Polygon
    polygon.feature = event.layer.toGeoJSON()
    polygon.feature.properties.name = `自定义多边形 ${drawnPolygonsLayer.getLayers().length + 1}`
    initPolygon(polygon)
    polygon.setStyle(polygonStyles.customPolygonStyle())
    polygon.setStyle(polygonStyles.highlighted())
    polygon.on('mouseover', (e: L.LeafletMouseEvent) => highlightFeature(e))
    polygon.on('mouseout', (e: L.LeafletMouseEvent) => resetHighlight(e))
    polygon.on('click', (e: L.LeafletMouseEvent) => selectPolygon(e))
    drawnPolygonsLayer.addLayer(polygon)
    selected.value.push(polygon)
  })
  map.on('draw:edited', (e) => {
    const event = e as L.DrawEvents.Edited
    event.layers.eachLayer((layer) => {
      const polygon = layer as Polygon
      const geojson = polygon.toGeoJSON()
      polygon.feature = geojson
      const index = selected.value.findIndex((x) => x._leaflet_id === polygon._leaflet_id)
      if (index != -1) selected.value[index] = polygon
    })
  })
  map.on('draw:deleted', (e) => {
    const event = e as L.DrawEvents.Deleted
    event.layers.eachLayer((layer) => {
      const polygon = layer as Polygon
      clearPolygon(polygon)
      const index = selected.value.findIndex((x) => x._leaflet_id === polygon._leaflet_id)
      if (index != -1) selected.value.splice(index, 1)
    })
  })

  map.on('zoom', ({ target }) => {
    currentZoom.value = target.getZoom()
  })
  map.on('zoomend', ({ target }) => {
    currentZoom.value = target.getZoom()
  })

  const mapDiv = document.getElementById('map') as HTMLElement
  const resizeObserver = new ResizeObserver(() => {
    map.invalidateSize()
    // Hack for tiles not loading after hard refresh on firefox
    const zoom = map.getZoom()
    map.setZoom(zoom - 1)
    map.setZoom(zoom + 1)
  })
  resizeObserver.observe(mapDiv)

  // we move leaflet controls out of the #map container for z-index
  const drawControlContainer = map.getContainer().querySelector('.leaflet-control-container')
  const ui = document.getElementById('leaflet-ui')
  if (ui && drawControlContainer) {
    ui.appendChild(drawControlContainer)
  }

  return map
}

function toggleMap() {
  allLayers.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer)
    }
  })
  petalMapsLayer.addTo(map)
  baiduCoverageLayer.addTo(map)
}

const copyCoords = (e: L.ContextMenuItemClickEvent) => {
  navigator.clipboard.writeText(e.latlng.lat.toFixed(7) + ', ' + e.latlng.lng.toFixed(7))
}
const openNearestPano = (e: L.ContextMenuItemClickEvent) => {
  open(
    `https://map.baidu.com/?newmap=1&shareurl=1&panotype=street&l=18&tn=B_NORMAL_MAP&sc=0&pc=${e.latlng.lng},${e.latlng.lat}`,
  )
}

function initPolygon(polygon: Polygon) {
  if (!polygon.found) polygon.found = []
  if (!polygon.nbNeeded) polygon.nbNeeded = 10000
  if (!polygon.checkedPanos) polygon.checkedPanos = new Set()
}

function selectPolygon(e: L.LeafletMouseEvent) {
  if (state.started) return
  const polygon = e.target as Polygon
  const index = selected.value.findIndex((x) => x._leaflet_id === polygon._leaflet_id)
  if (index == -1) {
    polygon.setStyle(polygonStyles.highlighted())
    selected.value.push(polygon)
  } else {
    selected.value.splice(index, 1)
    resetHighlight(e)
  }
}

const loadedLayers: Record<string, L.GeoJSON> = {}

type MarkerLayersTypes = 'gen4' | 'newRoad'
const markerLayers: Record<MarkerLayersTypes, L.MarkerClusterGroup> = {
  gen4: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
  newRoad: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
}

// ============ High Performance WebGL Rendering (glify) ============
// Color scheme matching the marker icons (RGB values 0-255 normalized to 0-1)
const GLIFY_COLORS: Record<MarkerLayersTypes, L.glify.IColor> = {
  gen4: { r: 40 / 255, g: 128 / 255, b: 202 / 255 },
  newRoad: { r: 202 / 255, g: 40 / 255, b: 63 / 255 },
}

// Store point data for WebGL rendering
interface GlifyPoint {
  lat: number
  lng: number
  panoId: string
  type: MarkerLayersTypes
  polygonId: number
  location: Panorama  // Store full location data for click events
}

const GLIFY_CONFIG = {
  updateInterval: 500, 
}

let glifyPoints: GlifyPoint[] = []
let glifyPointsInstance: L.glify.PointsInstance | null = null
let glifyEnabled = false
let glifyClickHandler: ((location: Panorama) => void) | null = null


let pendingNewPoints: GlifyPoint[] = []
let lastUpdateTime = 0
let updateScheduledTimerId: ReturnType<typeof setTimeout> | null = null

function getGlifyUpdateInterval(): number {
  const count = glifyPoints.length
  if (count > 10000) return 3000
  if (count > 5000) return 2000
  if (count > 1000) return 1000
  return GLIFY_CONFIG.updateInterval
}

function cancelGlifyScheduledUpdate() {
  if (updateScheduledTimerId !== null) {
    clearTimeout(updateScheduledTimerId)
    updateScheduledTimerId = null
  }
}

function getPointVisibilityFilter(): (point: GlifyPoint) => boolean {
  return (point) => {
    switch (point.type) {
      case 'gen4':
        return settings.markers.gen4
      case 'newRoad':
        return settings.markers.newRoad
      default:
        return true
    }
  }
}

function buildGeoJSONFeature(point: GlifyPoint, pointIndex: number): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.lat, point.lng], 
    },
    properties: {
      index: pointIndex,
      panoId: point.panoId,
      type: point.type,
      polygonId: point.polygonId,
      _pointIndex: pointIndex,
    },
  }
}

function getGlifyData(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const isVisible = getPointVisibilityFilter()
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  
  for (let i = 0; i < glifyPoints.length; i++) {
    const point = glifyPoints[i]
    if (isVisible(point)) {
      features.push(buildGeoJSONFeature(point, i))
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

function scheduleGlifyUpdate() {
  if (updateScheduledTimerId !== null) return

  const interval = getGlifyUpdateInterval()
  const timeSinceLastUpdate = Date.now() - lastUpdateTime
  const delay = Math.max(0, interval - timeSinceLastUpdate)

  updateScheduledTimerId = setTimeout(() => {
    updateScheduledTimerId = null
    requestAnimationFrame(() => flushGlifyUpdate())
  }, delay)
}

function flushGlifyUpdate() {
  if (!map || !glifyEnabled || pendingNewPoints.length === 0) {
    return
  }

  lastUpdateTime = Date.now()

  refreshGlifyLayer()
  pendingNewPoints = []
}

function refreshGlifyLayer() {
  if (!map || !glifyEnabled) return

  const data = getGlifyData()
  if (data.features.length === 0) {
    if (glifyPointsInstance) {
      glifyPointsInstance.remove()
      glifyPointsInstance = null
    }
    return
  }

  if (glifyPointsInstance) {
    glifyPointsInstance.update(data)
    return
  }

  glifyPointsInstance = L.glify.points({
    map: map,
    data: data,
    size: 12,
    opacity: 1,
    color: (index, feature) => {
      if (typeof feature === 'object' && 'properties' in feature) {
        const type = feature.properties?.type as MarkerLayersTypes
        return GLIFY_COLORS[type] || GLIFY_COLORS.gen4
      }
      return GLIFY_COLORS.gen4
    },
    click: (_e, feature, _xy) => {
      if (typeof feature === 'object' && 'properties' in feature) {
        const pointIndex = feature.properties?._pointIndex as number
        if (pointIndex !== undefined && glifyPoints[pointIndex]) {
          const point = glifyPoints[pointIndex]
          if (glifyClickHandler && point.location) {
            glifyClickHandler(point.location)
          }
        }
      }
      return true
    },
    sensitivity: 2,
    pane: 'labelPane',
  })
}

function setGlifyMode(enabled: boolean) {
  glifyEnabled = enabled
  settings.markers.glify = enabled

  if (enabled) {
    // Disable cluster mode when enabling high performance
    settings.markers.cluster = false
    
    // Hide all Leaflet marker layers
    Object.values(markerLayers).forEach(layer => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    })
    
    // Clear pending updates and render initial layer
    pendingNewPoints = []
    refreshGlifyLayer()
  } else {
    // Remove glify layer
    if (glifyPointsInstance) {
      glifyPointsInstance.remove()
      glifyPointsInstance = null
    }
    
    cancelGlifyScheduledUpdate()
    
    // Restore Leaflet marker layers based on settings
    Object.entries(markerLayers).forEach(([key]) => {
      updateMarkerLayers(key as MarkerLayersTypes)
    })
  }
}

function addGlifyPoint(location: Panorama, type: MarkerLayersTypes, polygonId: number) {
  glifyPoints.push({
    lng: location.lng,
    lat: location.lat,
    panoId: location.panoId,
    type,
    polygonId,
    location,
  })
  
  if (glifyEnabled) {
    pendingNewPoints.push(glifyPoints[glifyPoints.length - 1])
    scheduleGlifyUpdate()
  }
}

const IMPORTED_LOCATIONS_POLYGON_ID = 0

function removeGlifyPointsForPolygon(polygonId: number) {
  const beforeCount = glifyPoints.length
  glifyPoints = glifyPoints.filter(p => p.polygonId !== polygonId)
  
  if (beforeCount !== glifyPoints.length) {
    pendingNewPoints = pendingNewPoints.filter(p => p.polygonId !== polygonId)
    if (glifyEnabled) {
      refreshGlifyLayer()
    }
  }
}

function removeGlifyPointByPanoId(panoId: string) {
  const beforeCount = glifyPoints.length
  glifyPoints = glifyPoints.filter((p) => p.panoId !== panoId)
  pendingNewPoints = pendingNewPoints.filter((p) => p.panoId !== panoId)

  if (beforeCount !== glifyPoints.length && glifyEnabled) {
    refreshGlifyLayer()
  }
}

function removeGlifyPointsForImported() {
  removeGlifyPointsForPolygon(IMPORTED_LOCATIONS_POLYGON_ID)
}

function clearGlifyPoints() {
  glifyPoints = []
  pendingNewPoints = []
  
  if (glifyPointsInstance) {
    glifyPointsInstance.remove()
    glifyPointsInstance = null
  }
  
  cancelGlifyScheduledUpdate()
}

function registerGlifyClickHandler(handler: (location: Panorama) => void) {
  glifyClickHandler = handler
}

// ============ End High Performance Rendering ============

export interface LayerMeta {
  label: string
  key: string
  source: string | L.Layer | GeoJSON.GeoJsonObject
  visible: boolean
}
const availableLayers = ref<LayerMeta[]>([
  {
    label: '中国边界',
    key: 'china_borders',
    source: '/geojson/china_borders.json',
    visible: true,
  },
  {
    label: '已绘制多边形',
    key: 'drawn_polygons',
    source: drawnPolygonsLayer,
    visible: true,
  },
])

async function loadLayer(layer: LayerMeta) {
  if (loadedLayers[layer.key]) return loadedLayers[layer.key]

  let geoJsonLayer: L.GeoJSON

  if (layer.key === 'drawn_polygons') {
    geoJsonLayer = drawnPolygonsLayer
  } else {
    let data: GeoJSON.GeoJsonObject
    if (typeof layer.source === 'string') {
      const response = await fetch(layer.source)
      data = await response.json()
    } else {
      data = layer.source as unknown as GeoJSON.GeoJsonObject
    }

    const style = polygonStyles.customPolygonStyle

    geoJsonLayer = L.geoJSON(data, { style, onEachFeature })
    geoJsonLayer.eachLayer((polygon) => {
      initPolygon(polygon as Polygon)
    })
  }
  loadedLayers[layer.key] = geoJsonLayer
  return geoJsonLayer
}

async function toggleLayer(layer: LayerMeta) {
  if (layer.visible) {
    const loaded = await loadLayer(layer)
    map.addLayer(loaded)
  } else {
    const loaded = loadedLayers[layer.key]
    if (loaded) map.removeLayer(loaded)
  }
}

function toggleMapTheme(theme: MapTheme) {
  if (!map) return
  petalMapsLayer.setUrl(PETAL_MAPS_TEMPLATE[theme])
}

function setCoverageLayerOpacity(opacity: number) {
  Object.values(overlayMaps).forEach((layer) => {
    if (map.hasLayer(layer)) {
      layer.setOpacity(opacity)
    }
  })
}

function selectLayer(layerKey: string) {
  const layer = loadedLayers[layerKey]
  if (!layer) return

  const alreadySelected = new Set(selected.value.map((p) => p._leaflet_id))
  const toAdd: Polygon[] = []

  layer.eachLayer((polygon) => {
    const p = polygon as Polygon
    if (!alreadySelected.has(p._leaflet_id)) {
      toAdd.push(p)
    }
  })
  layer.setStyle(polygonStyles.highlighted)
  selected.value.push(...toAdd)
}

function deselectLayer(layerKey: string) {
  const layer = loadedLayers[layerKey]
  if (!layer) return

  const idsToRemove = new Set<number>()

  layer.eachLayer((polygon) => {
    const p = polygon as Polygon
    if (p._leaflet_id) {
      idsToRemove.add(p._leaflet_id)
    }
  })
  layer.setStyle(polygonStyles.customPolygonStyle)
  selected.value = selected.value.filter((p) => !idsToRemove.has(p._leaflet_id))
}

async function importLayer(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const results = {
    successful: 0,
    failed: 0,
    failedFiles: [] as string[],
  }

  // Process files sequentially to avoid race conditions
  for (const file of input.files) {
    try {
      const result = await readFileAsText(file)
      const json = JSON.parse(result)
      
      if (!isValidGeoJSON(json)) {
        throw new Error('GeoJSON 结构无效。')
      }

      // Generate unique key using timestamp and random id to avoid duplicates
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const meta: LayerMeta = {
        label: file.name,
        key: `imported_${uniqueId}`,
        source: json,
        visible: true,
      }
      
      availableLayers.value.push(meta)
      const layer = await loadLayer(meta)
      map.addLayer(layer)
      
      results.successful++
    } catch (err) {
      results.failed++
      results.failedFiles.push(file.name)
      console.error(`Error importing "${file.name}":`, err)
    }
  }

  // Reset file input to allow re-importing the same files
  input.value = ''
}

function exportLayer(l: LayerMeta) {
  const layer = loadedLayers[l.key]
  if (!layer) return

  const dataUri =
    'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(layer.toGeoJSON()))
  const fileName = l.label ?? '自定义图层'
  const linkElement = document.createElement('a')
  linkElement.href = dataUri
  linkElement.download = fileName
  linkElement.click()
}

async function importGeoJSONFromSearch(geojson: GeoJSON.GeoJsonObject, name: string) {
  if (!isValidGeoJSON(geojson)) {
    console.error('Invalid GeoJSON received:', geojson)
    throw new Error('GeoJSON 结构无效，请尝试其他地点。')
  }

  try {
    // Parse features from GeoJSON
    let features: GeoJSON.Feature[] = []
    
    if (geojson.type === 'Feature') {
      features = [geojson as GeoJSON.Feature]
    } else if (geojson.type === 'FeatureCollection') {
      features = (geojson as GeoJSON.FeatureCollection).features
    }

    if (features.length === 0) {
      throw new Error('GeoJSON 中未找到有效要素')
    }

    // Add each feature as a polygon to drawnPolygonsLayer
    const toSelect: Polygon[] = []
    const bounds: L.LatLngBounds[] = []
    
    features.forEach((feature, index) => {
      // Create temporary GeoJSON layer to parse the feature
      const tempLayer = L.geoJSON(feature, { 
        style: polygonStyles.customPolygonStyle()
      })
      
      const layers = tempLayer.getLayers()
      if (layers.length > 0) {
        const polygon = layers[0] as Polygon
        
        // Set properties and name
        polygon.feature = feature as any
        polygon.feature.properties = polygon.feature.properties || {} as any
        
        // Use search name for single feature, add index for multiple features
        if (features.length === 1) {
          (polygon.feature.properties as any).name = name
        } else {
          (polygon.feature.properties as any).name = `${name} (${index + 1})`
        }
        
        // Initialize polygon properties
        initPolygon(polygon)
        
        // Set highlight style and add event listeners
        polygon.setStyle(polygonStyles.highlighted())
        polygon.on('mouseover', (e: L.LeafletMouseEvent) => highlightFeature(e))
        polygon.on('mouseout', (e: L.LeafletMouseEvent) => resetHighlight(e))
        polygon.on('click', (e: L.LeafletMouseEvent) => selectPolygon(e))
        
        // Add to drawn polygons layer
        drawnPolygonsLayer.addLayer(polygon)
        toSelect.push(polygon)
        
        // Collect bounds for fitting view
        if ('getBounds' in polygon) {
          bounds.push((polygon as any).getBounds())
        }
      }
    })
    
    // Select all imported polygons
    selected.value.push(...toSelect)
    
    // Fit map view to imported polygons
    if (bounds.length > 0) {
      const featureBounds = bounds.reduce((acc, b) => {
        return acc ? acc.extend(b) : b
      })
      if (featureBounds) {
        map.fitBounds(featureBounds, { padding: [50, 50] })
      }
    }
    
  } catch (err) {
    console.error('Error importing GeoJSON:', err)
    throw new Error(`导入 GeoJSON 失败：${err instanceof Error ? err.message : '未知错误'}`)
  }
}

function updateMarkerLayers(gen: MarkerLayersTypes) {
  // In high performance mode, just refresh the glify layer
  if (glifyEnabled) {
    refreshGlifyLayer()
    return
  }

  if (
    (gen === 'gen4' && settings.markers.gen4) ||
    (gen === 'newRoad' && settings.markers.newRoad)
  ) {
    map.addLayer(markerLayers[gen])
    if (!settings.markers.cluster) markerLayers[gen].disableClustering()
    else markerLayers[gen].enableClustering()
  } else {
    map.removeLayer(markerLayers[gen])
  }
}

function updateClusters() {
  // Cluster mode is mutually exclusive with high performance mode
  if (glifyEnabled) {
    return
  }
  
  Object.values(markerLayers).forEach((markerLayer) => {
    if (settings.markers.cluster) markerLayer.enableClustering()
    else markerLayer.disableClustering()
  })
}

function clearPolygon(polygon: Polygon) {
  Object.values(markerLayers).forEach((markerLayer) => {
    const toRemove = markerLayer.getLayers().filter((layer) => {
      const marker = layer as L.Marker
      return marker.polygonID === polygon._leaflet_id
    })
    toRemove.forEach((marker) => {
      markerLayer.removeLayer(marker)
    })
  })
  // Also clear high performance points for this polygon
  removeGlifyPointsForPolygon(polygon._leaflet_id)
  polygon.found.length = 0
  resetPolygonSearchState(polygon)
}

function clearMarkers() {
  Object.values(markerLayers).forEach((markerLayer) => {
    markerLayer.clearLayers()
  })
  // Also clear high performance points
  clearGlifyPoints()
}

function onEachFeature(_: Feature, layer: L.Layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: selectPolygon,
  })
}

function highlightFeature(e: L.LeafletMouseEvent) {
  if (state.started) return
  const polygon = e.target as Polygon
  if (!selected.value.some((x) => x._leaflet_id === polygon._leaflet_id)) {
    polygon.setStyle(polygonStyles.highlighted())
  }
  select.value = `${getPolygonName(polygon.feature.properties)} ${polygon.found ? '(' + polygon.found.length + ')' : '(0)'}`
}

function resetHighlight(e: L.LeafletMouseEvent) {
  const polygon = e.target as Polygon
  if (!selected.value.some((x) => x._leaflet_id === polygon._leaflet_id)) {
    polygon.setStyle(polygonStyles.removeHighlight())
  }
  select.value = '选择中国区域或绘制多边形'
}

const polygonStyles = {
  defaultHidden: () => ({
    opacity: 0,
    fillOpacity: 0,
  }),

  customPolygonStyle: () => ({
    weight: 2,
    color: getRandomColor(),
    fillOpacity: 0,
  }),

  highlighted: () => ({
    fillColor: getRandomColor(),
    fillOpacity: 0.5,
  }),

  removeHighlight: () => ({
    fillOpacity: 0,
  }),
}

function getRandomColor() {
  const red = Math.floor(((1 + Math.random()) * 256) / 2)
  const green = Math.floor(((1 + Math.random()) * 256) / 2)
  const blue = Math.floor(((1 + Math.random()) * 256) / 2)
  return 'rgb(' + red + ', ' + green + ', ' + blue + ')'
}

const icons = {
  gen4: L.icon({ iconUrl: markerBlue, iconAnchor: [12, 41] }),
  newLoc: L.icon({ iconUrl: markerRed, iconAnchor: [12, 41] }),
}

function fitMapToLatLngs(points: LatLng[], padding: [number, number] = [40, 40]) {
  if (!map || points.length === 0) return

  let bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]))
  const center = bounds.getCenter()
  const latSpan = bounds.getNorth() - bounds.getSouth()
  const lngSpan = bounds.getEast() - bounds.getWest()

  // Single point or coincident points: give bounds a minimal span so zoom can be derived
  const minSpan = 0.002
  if (latSpan < minSpan || lngSpan < minSpan) {
    const halfLat = Math.max(latSpan, minSpan) / 2
    const halfLng = Math.max(lngSpan, minSpan) / 2
    bounds = L.latLngBounds(
      [center.lat - halfLat, center.lng - halfLng],
      [center.lat + halfLat, center.lng + halfLng],
    )
  }

  const paddingPoint = L.point(padding[1], padding[0])
  const zoom = map.getBoundsZoom(bounds, false, paddingPoint)
  const clampedZoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), zoom))
  map.setView(bounds.getCenter(), clampedZoom)
}

export {
  L,
  initMap,
  toggleMap,
  selectLayer,
  deselectLayer,
  toggleLayer,
  toggleMapTheme,
  setCoverageLayerOpacity,
  importLayer,
  importGeoJSONFromSearch,
  exportLayer,
  updateMarkerLayers,
  availableLayers,
  markerLayers,
  updateClusters,
  clearMarkers,
  currentZoom,
  icons,
  setGlifyMode,
  addGlifyPoint,
  registerGlifyClickHandler,
  removeGlifyPointsForPolygon,
  removeGlifyPointByPanoId,
  removeGlifyPointsForImported,
  IMPORTED_LOCATIONS_POLYGON_ID,
  fitMapToLatLngs,
  type MarkerLayersTypes,
}
