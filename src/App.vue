<template>
  <div id="map"></div>
  <div id="leaflet-ui"></div>
  <div class="absolute bottom-1 left-1/2 -translate-x-1/2 font-bold text-xs text-black">
    Zoom : {{ currentZoom }}
  </div>
  <div class="absolute top-1 left-1 min-w-95 max-w-[calc(80vw)] 
  max-h-[calc(100vh-50px)] flex flex-col gap-1">
    <div class="container">
      <h1 class="logo px-2 py-0.5 flex gap-0.5 items-center justify-center text-xl tracking-tighter">
        Baidu MapGenerat
        <Spinner icon="baidu" /> r
      </h1>
    </div>
    <div class="flex-1 min-h-0 flex flex-col gap-1">
      <div class="container flex flex-col">
        <div class="relative cursor-pointer" @click="panels.general = !panels.general">
          <h2>General</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <Collapsible :is-open="panels.general" class="flex flex-col gap-1 max-h-[180px] overflow-y-auto mt-2 p-1">
          <div class="flex items-center justify-between ml-1 mr-1">
            Theme :
            <select v-model="themeMode" class="w-22 ml-10">
              <option value="auto">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div class="flex items-center justify-between ml-1 mr-1">
            Notifications :
            <select v-model="settings.notification.enabled" class="w-22 ml-2">
              <option :value=true>On</option>
              <option :value=false>Off</option>
            </select>
          </div>
          <div v-if="settings.notification.enabled" class="flex-1 ml-4 mb-1">
            <Checkbox v-model="settings.notification.anyLocation">
              First location found in polygon
            </Checkbox>
            <Checkbox v-model="settings.notification.onePolygonComplete">
              One polygon completed
            </Checkbox>
            <Checkbox v-model="settings.notification.allPolygonsComplete">
              All polygons completed
            </Checkbox>
          </div>
          <div class="flex items-center justify-between ml-1 mr-1">
            Scheduled Task :
            <select v-model="settings.scheduled.enabled" class="w-22 ml-2" @change="handleScheduledChange">
              <option :value=true>On</option>
              <option :value=false>Off</option>
            </select>
          </div>
          <div v-if="settings.scheduled.enabled" class="flex flex-col ml-4 gap-1 mr-1">
            <div class="flex items-center justify-between">
              Start After :
              <span>
                <input type="number" v-model.number="settings.scheduled.after" min="0.1"
                  class="w-16 h-5 px-2 py-1 border rounded text-right" @change="validateScheduleTime" /> min
              </span>
            </div>
            <div class="flex items-center justify-between">
              Task Lasting :
              <span>
                <input type="number" v-model.number="settings.scheduled.last" min="0.1"
                  class="w-16 h-5 px-2 py-1 border rounded text-right" @change="validateScheduleTime" /> min
              </span>
            </div>
            <div class="flex items-center justify-between">
              Repeat Interval :
              <span>
                <input type="number" v-model.number="settings.scheduled.interval" min="0"
                  class="w-16 h-5 px-2 py-1 border rounded text-right" @change="validateScheduleTime" /> min
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between ml-1 mr-1">
            Maps Theme :
            <select v-model="settings.mapTheme" class="w-22 ml-2 text-xs" @change="toggleMapTheme(settings.mapTheme)">
              <option value="default">Default</option>
              <option value="classic">Classic</option>
              <option value="retro">Retro</option>
              <option value="dark">Dark</option>
              <option value="night">Night</option>
              <option value="aubergine">Aubergine</option>
            </select>
          </div>
          <div class="flex items-center justify-between ml-1 mr-1">
            Coverage Opacity :
            <Slider v-model="settings.coverage.opacity" class="w-41 mr-3" @update:modelValue="setCoverageLayerOpacity"
              :min="0" :max="1.0" :step="0.1" :showTooltip="'focus'" :format="val => Number(val).toFixed(1)" />
          </div>
        </Collapsible>
      </div>
    </div>
    <div class="flex-1 min-h-0 flex flex-col gap-1">
      <div v-if="!state.started" class="container flex flex-col">
        <div class="relative cursor-pointer" @click="panels.layer = !panels.layer">
          <h2>Layers</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>

        <Collapsible :is-open="panels.layer" class="flex flex-col gap-1 max-h-[220px] overflow-y-auto mt-2 p-1">
          <div class="relative">
            <GeoJSONSearch @import="handleGeoJSONImport" @importSubdivisions="handleImportSubdivisions" />
            <hr />
          </div>
          <div v-for="layer in availableLayers" :key="layer.key" class="flex gap-1 justify-between">
            <Checkbox v-model="layer.visible" @change="toggleLayer(layer as LayerMeta)" class="truncate">
              <span class="truncate">{{ layer.label }}</span>
            </Checkbox>
            <div class="flex gap-1">
              <Button size="sm" @click="selectLayer(layer.key)">Select All</Button>
              <Button size="sm" variant="danger" @click="deselectLayer(layer.key)">
                Deselect All
              </Button>
              <Button squared size="sm" title="Export layer" @click="exportLayer(layer as LayerMeta)">
                <FileExportIcon class="w-5 h-5" />
              </Button>
            </div>
          </div>
          <input type="file" class="mr-auto mt-1" @change="importLayer" accept=".txt,.json,.geojson" multiple />
        </Collapsible>
      </div>

      <div v-if="!state.started" class="container font-bold text-center">{{ select }}</div>

      <div v-if="selected.length" class="container max-h-[300px] flex-1 min-h-0 flex flex-col gap-1">
        <h2>China Regions ({{ selected.length }})</h2>
        <div class="px-1">
          <Checkbox v-model="settings.markersOnImport" title="This may affect performance.">
            Add markers to imported locations
          </Checkbox>
          <div v-if="settings.markersOnImport" class="ml-4">
            <label class="text-s">Markers opacity: {{ Math.round((settings.importedMarkersOpacity ?? 1.0) * 100)
              }}%</label>
            <Slider v-model="settings.importedMarkersOpacity" @input="updateImportedMarkersOpacity"
              :value="settings.importedMarkersOpacity ?? 1.0" :max="1.0" :step="0.01" :tooltips="false" :lazy="false"
              class="mt-1 w-80" />
            <Checkbox v-model="settings.useUpdateTypeIconsOnImport"
              title="Use appropriate icons based on the update type." class="mt-2">
              Use icons based on update type
            </Checkbox>
          </div>
          <Checkbox v-model="settings.checkImports" title="Search for more panos around imported locations.">
            Check imported locations
          </Checkbox>
          <hr />
        </div>

        <div class="polygon-list">
          <div v-for="polygon of selected" :key="polygon._leaflet_id" class="polygon-item">
            <Button size="sm" squared title="Import locations">
              <label class="cursor-pointer">
                <input type="file" accept=".json" hidden @change="importLocations($event, polygon as Polygon)" />
                <FileImportIcon class="w-5 h-5" />
              </label>
            </Button>
            <span v-if="polygon.feature.properties.code"
              :class="`flag-icon flag-` + polygon.feature.properties.code.toLowerCase()"></span>
            <label class="polygon-name" @click="changePolygonName(polygon.feature.properties)">
              {{ getPolygonName(polygon.feature.properties) }}
            </label>
            <Spinner v-if="state.started && polygon.isProcessing" icon="baidu" />

            <div class="polygon-counter">
              {{ polygon.found.length }}
              <span>/</span>
              <input type="number" :min="polygon.found ? polygon.found.length : 0" v-model="polygon.nbNeeded" />
            </div>

            <div class="polygon-actions">
              <Clipboard :data="[polygon as Polygon]" :disabled="!polygon.found.length" :mode="settings.panoId"
                :tag="settings.tag" />
              <ExportToJSON :data="[polygon as Polygon]" :disabled="!polygon.found.length" :mode="settings.panoId"
                :tag="settings.tag" />
              <ExportToCSV :data="[polygon as Polygon]" :disabled="!polygon.found.length" />
              <Button size="sm" squared variant="danger" :disabled="!polygon.found.length"
                title="Delete locations for polygon" @click="clearPolygon(polygon as Polygon)">
                <TrashBinIcon class="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="flex items-center gap-2 p-1">
        <h2>Export all ({{ totalLocs }})</h2>
        <Button class="ml-auto" size="sm" title="Change locations cap for all selected" @click="changeLocationsCap">
          Edit cap for all
        </Button>
        <div class="flex gap-1">
          <Clipboard :data="selected as Polygon[]" :disabled="!totalLocs" :mode="settings.panoId" :tag="settings.tag" />
          <ExportToJSON :data="selected as Polygon[]" :disabled="!totalLocs" :mode="settings.panoId"
            :tag="settings.tag" />
          <ExportToCSV :data="selected as Polygon[]" :disabled="!totalLocs" />
          <Button size="sm" squared variant="danger" :disabled="!totalLocs" title="Delete all locations"
            @click="clearAllLocations">
            <TrashBinIcon class="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  </div>

  <div class="absolute bottom-1 sm:top-1 sm:bottom-auto right-1 w-70 sm:w-75 md:w-80
  max-h-[calc(100vh-16px)] overflow-hidden flex flex-col gap-1">
    <div class="flex flex-col gap-1 flex-1 min-h-0">
      <div v-if="!state.started" class="container flex flex-col flex-1 min-h-0">
        <div class="relative cursor-pointer" @click="panels.generatorSettings = !panels.generatorSettings">
          <h2>Generator settings</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto">
          <Collapsible :is-open="panels.generatorSettings" class="mt-1 p-1 pr-2">
            <div class="flex items-center justify-between">
              PanoId :
              <select v-model="settings.panoId" class="w-24 ml-10">
                <option value="enable">Enable</option>
                <option value="disable">Disable</option>
                <option value="prefix">Prefix</option>
              </select>
            </div>

            <div class="flex items-center justify-between">
              Strategy :
              <select v-model="settings.strategy" class="w-24"
                title="Random: generates random coordinates within polygon. Grid: systematically covers polygon with grid-based coordinates using search radius.">
                <option value="random">Random</option>
                <option value="grid">Grid</option>
              </select>
            </div>

            <div class="flex justify-between">
              Generators :
              <div class="flex items-center gap-4">
                <input type="number" v-model.number="settings.numOfGenerators" min="1" max="10"
                  class="w-8 h-5 px-2 py-1 border rounded text-right" />
                <Slider v-model="settings.numOfGenerators" range="true" :min="1" :max="10" :step="1" :tooltips="false"
                  :lazy="false" class="w-30 mr-2" />
              </div>
            </div>

            <div class="flex justify-between">
              Speed :
              <span>
                <input type="number" v-model.number="settings.speed" min="1" max="1000" @input="handleSpeedInput" />
                attempts
              </span>
            </div>

            <div class="flex items-center justify-between">
              Radius :
              <span>
                <input type="number" v-model.number="settings.radius" @change="handleRadiusInput" />
                m
              </span>
            </div>

            <Checkbox v-model="settings.oneCountryAtATime">
              Only check one region/polygon at a time
            </Checkbox>

            <div>
              <Checkbox v-model="settings.findRegions">Minimum distance between locations</Checkbox>
              <div v-if="settings.findRegions" class="ml-6">
                <input type="number" v-model.number="settings.regionRadius" /> <span> km </span>
              </div>
            </div>

            <Checkbox v-model="settings.tag">
              Enable auto tagging for locations
            </Checkbox>
          </Collapsible>
        </div>
      </div>

      <div v-if="!state.started" class="container flex flex-col flex-1 min-h-0">
        <div class="cursor-pointer relative" @click="panels.coverageSettings = !panels.coverageSettings">
          <h2>Coverage settings</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto">
          <Collapsible :is-open="panels.coverageSettings" class="p-1">
            <Checkbox v-model="settings.rejectDateless">Reject locations without date</Checkbox>

            <Checkbox v-model="settings.rejectNoDescription">
              Reject locations without description
            </Checkbox>
            <Checkbox v-model="settings.rejectRoadName">
              Reject locations with road name
            </Checkbox>

            <Checkbox v-model="settings.onlyOneInTimeframe"
              title="Only allow locations that don't have other nearby coverage in timeframe.">
              Only one panorama on location
            </Checkbox>

            <Checkbox v-model="settings.checkLinks">Check linked panos</Checkbox>
            <div v-if="settings.checkLinks" class="flex items-center justify-between ml-6">
              Depth :
              <div class="flex items-center gap-2">
                {{ settings.linksDepth }}
                <input type="range" v-model.number="settings.linksDepth" min="1" max="10" />
              </div>
            </div>

            <div v-if="!settings.selectMonths" class="flex flex-col gap-0.5">
              <div class="flex justify-between">
                From :
                <input :type="'month'" v-model="settings.fromDate" min="2007-01" :max="currentDate" />
              </div>
              <div class="flex justify-between">
                To :
                <input :type="'month'" v-model="settings.toDate" min="2007-01" :max="currentDate" />
              </div>
            </div>

            <div>
              <Checkbox v-model="settings.selectMonths">Filter by months</Checkbox>
              <div v-if="settings.selectMonths" class="flex flex-col gap-0.5 ml-6">
                <div>
                  From
                  <select v-model="settings.fromMonth">
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                  to
                  <select v-model="settings.toMonth">
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
                <div>
                  Between
                  <input type="number" v-model.number="settings.fromYear" min="2007" />
                  and
                  <input type="number" v-model.number="settings.toYear" min="2007" />
                </div>
              </div>
            </div>

            <div class="flex items-center">
              <Checkbox v-model="settings.filterByMinutes.enabled">Filter by minutes</Checkbox>
              <Slider v-if="settings.filterByMinutes.enabled" v-model="settings.filterByMinutes.range" :min="0"
                :max="1439" :step="5" :showTooltip="'focus'" :range="true" class="w-48 ml-2" :format="val => {
                  const h = Math.floor(val / 60).toString().padStart(2, '0')
                  const m = Math.floor(val % 60).toString().padStart(2, '0')
                  return `${h}:${m}`
                }" />
              <span v-if="settings.filterByMinutes.enabled" class="ml-2">
                {{ Math.floor(settings.filterByMinutes.range[0] / 60).toString().padStart(2, '0') }}:{{
                  (settings.filterByMinutes.range[0] % 60).toString().padStart(2, '0') }}
                -
                {{ Math.floor(settings.filterByMinutes.range[1] / 60).toString().padStart(2, '0') }}:{{
                  (settings.filterByMinutes.range[1] % 60).toString().padStart(2, '0') }}
              </span>
            </div>

            <Checkbox v-model="settings.checkAllDates"
              title="Checks all dates/panos at a location instead of only the default one. Mostly useful for countries with prior coverage where a new date may not be the default yet. May lower generation speed slightly if generating countries with prior coverage.">
              Check all dates</Checkbox>

            <Checkbox v-model="settings.randomInTimeline">
              Choose random date in time range
            </Checkbox>
          </Collapsible>
        </div>
      </div>

      <div v-if="!state.started"
        class="container settings flex flex-col flex-1 min-h-0">
        <div class="cursor-pointer relative" @click="panels.mapMakingSettings = !panels.mapMakingSettings">
          <h2>Map making settings</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <Collapsible :is-open="panels.mapMakingSettings" class="p-1">
            <div class="flex items-center gap-1 relative">
              <Checkbox v-model="settings.searchInDescription.enabled">Search in panorama description
              </Checkbox>
              <Tooltip>
                Description is usually based on your locale.<br />
                You can enter multiple search terms separated by commas.
              </Tooltip>
            </div>

            <div v-if="settings.searchInDescription.enabled" class="space-y-0.5 ml-6 py-1">
              <div class="flex justify-between items-center gap-1">
                <select v-model="settings.searchInDescription.filterType">
                  <option value="include">include</option>
                  <option value="exclude">exclude</option>
                </select>
                <input type="text" v-model.trim="settings.searchInDescription.searchTerms" class="w-full" />
              </div>

              <div class="flex justify-between items-center gap-2">
                <div class="flex items-center gap-1 relative">
                  Search mode
                  <Tooltip>
                    <strong>Search modes:</strong><br />
                    • <strong>contains</strong>: anywhere in text<br />
                    • <strong>fullword</strong>: exact word<br />
                    • <strong>sectionmatch</strong>: exact comma-separated section<br />
                    (eg: 901 N Main Ave, <strong>Springfield</strong>, Missouri)<br />
                    • <strong>startswith</strong>: beginning of word<br />
                    • <strong>endswith</strong>: end of word<br />
                  </Tooltip>
                </div>
                <select v-model="settings.searchInDescription.searchMode">
                  <option value="contains">contains</option>
                  <option value="fullword">fullword</option>
                  <option value="sectionmatch">sectionmatch</option>
                  <option value="startswith">startswith</option>
                  <option value="endswith">endswith</option>
                </select>
              </div>
            </div>

            <Checkbox v-model="settings.findByTileColor.enabled">Find by tile color</Checkbox>
            <div v-if="settings.findByTileColor.enabled" class="space-y-0.5 ml-6 pb-1">
              <div class="flex justify-between items-center gap-2">
                Include/Exclude :
                <select v-model="settings.findByTileColor.filterType">
                  <option value="include">include</option>
                  <option value="exclude">exclude</option>
                </select>
              </div>
              <div class="flex justify-between items-center gap-2">
                Tile provider :
                <select v-model="settings.findByTileColor.tileProvider">
                  <option value="gmaps">Google Maps</option>
                  <option value="osm">OSM</option>
                </select>
              </div>

              <div class="flex justify-between items-center gap-2">
                Tile zoom level :
                <span class="ml-auto">
                  {{ settings.findByTileColor.zoom }}
                </span>
                <input type="range" v-model.number="settings.findByTileColor.zoom" min="13" max="19" step="1"
                  title="Tile zoom level" />
              </div>

              <div class="flex justify-between items-center gap-2">
                Operator :
                <select v-model="settings.findByTileColor.operator">
                  <option value="OR">OR</option>
                  <option value="AND">AND</option>
                </select>
              </div>

              <div v-for="(tileColor, index) in settings.findByTileColor.tileColors[
                settings.findByTileColor.tileProvider
              ]" :key="index" :title="tileColor.label" class="flex items-center gap-2">
                <Checkbox v-model="tileColor.active" class="hover:brightness-100! truncate">
                  <span class="h-4 min-w-8" :style="{ backgroundColor: 'rgb(' + tileColor.colors[0] + ')' }" />
                  <span class="truncate">{{ tileColor.label }}</span>
                </Checkbox>
                <div v-if="tileColor.threshold >= 0.01" class="flex items-center gap-2 ml-auto">
                  <span>{{ (tileColor.threshold * 100).toFixed(0) }}%</span>
                  <input type="range" v-model.number="tileColor.threshold" min="0.01" max="1" step="0.01"
                    title="Color presence threshold" />
                </div>
              </div>
            </div>

            <Checkbox v-model="settings.filterByLinksLength.enabled">
              Filter by links length
            </Checkbox>
            <div v-if="settings.filterByLinksLength.enabled" class="ml-6">
              <label class="flex items-center justify-between">
                <div class="flex items-center gap-1 relative">
                  Range
                  <Tooltip>
                    0 : photosphere/isolated<br />
                    1 : one arrow (dead end)<br />
                    > 2 : intersection
                  </Tooltip>
                </div>
                <Slider v-model="settings.filterByLinksLength.range" :min="0" :max="5" tooltipPosition="bottom"
                  class="w-32 pr-2" />
              </label>
            </div>

            <Checkbox v-model="settings.filterByAltitude.enabled">
              Filter by altitude</Checkbox>
            <div v-if="settings.filterByAltitude.enabled" class="ml-6">
              <label class="flex items-center justify-between">
                <div class="flex items-center gap-1 relative">
                  Meters
                </div>
                <Slider v-if="settings.filterByAltitude.enabled" v-model="settings.filterByAltitude.range" :min="-200"
                  :max="8848" :step="10" :showTooltip="'always'" :range="true" :format="val => `${Math.round(val)}m`"
                  tooltipPosition="bottom" class="w-40 pr-2" />
              </label>
            </div>

            <Checkbox v-model="settings.getCurve"> Find curve locations </Checkbox>

            <label v-if="settings.getCurve" class="ml-6 flex items-center justify-between">
              Min curve angle ({{ settings.minCurveAngle }}°)
              <input type="range" v-model.number="settings.minCurveAngle" min="5" max="90" />
            </label>

            <Checkbox v-model="settings.heading.adjust">Set heading</Checkbox>
            <div v-if="settings.heading.adjust" class="ml-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="settings.heading.reference" value="link" />
                Along road
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="settings.heading.reference" value="forward" />
                To front of car
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="settings.heading.reference" value="backward" />
                To back of car
              </label>
              <label class="flex items-center justify-between">
                Deviation
                <Slider v-model="settings.heading.range" :min="-180" :max="180" tooltipPosition="bottom"
                  class="w-32 pr-2" />
              </label>
              <small>0° will point directly towards the road.</small>
              <Checkbox v-model="settings.heading.randomInRange">Random in range</Checkbox>
            </div>

            <div class="flex items-center justify-between">
              <Checkbox v-model="settings.pitch.adjust">Set pitch</Checkbox>
              <Slider v-if="settings.pitch.adjust" v-model="settings.pitch.range" :min="-90" :max="90"
                tooltipPosition="bottom" class="w-32 pr-2" />
            </div>
            <div v-if="settings.pitch.adjust" class="ml-6">
              <small>0° by default. -90° for tarmac, +90° for sky</small>
              <Checkbox v-model="settings.pitch.randomInRange">Random in range</Checkbox>
            </div>

            <div class="flex items-center justify-between">
              <Checkbox v-model="settings.zoom.adjust">Set zoom</Checkbox>
              <Slider v-if="settings.zoom.adjust" v-model="settings.zoom.range" :min="0" :max="4" :step="-1"
                tooltipPosition="bottom" class="w-32 pr-2" />
            </div>
            <Checkbox v-if="settings.zoom.adjust" v-model="settings.zoom.randomInRange" class="ml-6">Random in range
            </Checkbox>
          </Collapsible>
        </div>
      </div>

      <div class="container flex flex-col flex-1">
        <div class="cursor-pointer relative" @click="panels.marker = !panels.marker">
          <h2>Markers</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <div class="flex-1 min-h-0">
          <Collapsible :is-open="panels.marker" class="p-1">
            <Checkbox v-model="settings.markers.newRoad" v-on:change="updateMarkerLayers('newRoad')">
              <span class="h-3 w-3 bg-[#CA283F] rounded-full"></span>New Road
            </Checkbox>
            <Checkbox v-model="settings.markers.gen4" @change="updateMarkerLayers('gen4')">
              <span class="h-3 w-3 bg-[#2880CA] rounded-full"></span>Update
            </Checkbox>
            <Checkbox v-model="settings.markers.cluster" v-on:change="handleClusterToggle" 
              :disabled="settings.markers.glify"
              title="For lag reduction. Disabled when High Performance mode is on.">
              <span class="inline-block w-3 h-3 rounded-full" style="background: 
              linear-gradient(90deg, #FF5F6D, #FFC371, #F9F871, #A1FFCE, #58CFFB, #845EC2);
              background-size: 600% 600%;
              animation: gradientFlow 5s ease infinite;">
              </span>
              Cluster markers
            </Checkbox>
            <Checkbox v-model="settings.markers.glify" v-on:change="handleGlifyToggle"
              title="Use WebGL for rendering massive numbers of points.">
              <span class="inline-block w-3 h-3 rounded-full" style="background: 
              linear-gradient(60deg, #2880CA, #9A28CA, #24AC20, #CA283F, #E412D2);
              background-size: 400% 400%;
              animation: gradientFlow 3s ease infinite;">
              </span>
              High Performance
            </Checkbox>
            <Button :disabled="!totalLocs" size="sm" variant="warning"
              class="mt-2 w-full justify-center flex items-center gap-1"
              title="Clear markers (for performance, this won't erase your generated locations)" @click="clearMarkers">
              <MarkerIcon class="w-5 h-5" />Clear
            </Button>
          </Collapsible>
        </div>
      </div>

      <Button v-if="canBeStarted" @click="handleClickStart" :variant="state.started ? 'danger' : 'primary'"
        title="Space bar/Enter">{{ startButtonText }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onMounted, watch, computed, ref, onBeforeUnmount } from 'vue'
import { useStorage, useColorMode } from '@vueuse/core'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

import Slider from '@vueform/slider'
import Collapsible from '@/components/Elements/Collapsible.vue'
import Button from '@/components/Elements/Button.vue'
import Checkbox from '@/components/Elements/Checkbox.vue'
import Spinner from '@/components/Elements/Spinner.vue'
import Tooltip from '@/components/Elements/Tooltip.vue'
import Clipboard from '@/components/Clipboard.vue'
import ExportToJSON from '@/components/ExportToJSON.vue'
import ExportToCSV from '@/components/ExportToCSV.vue'
import GeoJSONSearch from '@/components/GeoJSONSearch.vue'
import FileImportIcon from '@/assets/icons/file-import.svg'
import FileExportIcon from '@/assets/icons/file-export.svg'
import MarkerIcon from '@/assets/icons/marker.svg'
import TrashBinIcon from '@/assets/icons/trash-bin.svg'
import ChevronDownIcon from '@/assets/icons/chevron-down.svg'
import { useStore } from '@/store'
import { settings } from '@/settings'

import {
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
  type LayerMeta,
  type MarkerLayersTypes,
} from '@/map'

import { getTileColorPresence } from '@/composables/tileColorDetector'
import {
  sendNotifications,
  randomPointInPoly,
  GridGenerator,
  hasAnyDescription,
  isAcceptableCurve,
  searchInDescription,
  getCurrentDate,
  parseDate,
  extractMonthYear,
  randomInRange,
  distanceBetween,
  readFileAsText,
  getPolygonName,
  changePolygonName,
  getMonthEndTimestamp,
} from '@/composables/utils.ts'
import StreetViewProviders from '@/providers'
import { isInChina } from '@/constants'
import {
  StreetViewStatus,
  type StreetViewLocationRequest,
  type StreetViewPanoramaData,
} from '@/streetview-types'

const { currentDate } = getCurrentDate()
const themeMode = useColorMode()

watch(
  () => settings.notification.enabled,
  async (enabled) => {
    if (enabled === true && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          settings.notification.enabled = false
          alert('Notification permission denied.')
        }
      } catch (err) {
        console.warn('Notification request failed:', err)
        settings.notification.enabled = false
      }
    }
  }
)

const panels = useStorage('map_generator__panels_v1', {
  general: true,
  layer: true,
  generatorSettings: true,
  coverageSettings: true,
  mapMakingSettings: true,
  marker: true,
})

const { selected, select, state } = useStore()
const allFoundPanoIds = new Set<string>()
const generationStartTime = ref<number>(0)
const scheduledTaskTimer = ref<number | null>(null)
const countdownTimer = ref<number | null>(null)
const pauseCountdownTimer = ref<number | null>(null)
const resumeCountdownTimer = ref<number | null>(null)
const countdown = ref<number>(0)
const pauseCountdown = ref<number>(0)
const resumeCountdown = ref<number>(0)

// Grid generators cache - persist across pause/resume
const gridGenerators = new Map<number, GridGenerator>()

const cachedDates = ref({
  fromDate: Date.parse(settings.fromDate),
  toDate: getMonthEndTimestamp(settings.toDate),
  lastFromDate: settings.fromDate,
  lastToDate: settings.toDate
})

function findDateInObject(obj: any): Date | null {
  for (const key in obj) {
    const value = obj[key]
    if (value instanceof Date) {
      return value
    }
  }
  return null
}

function getCachedDates() {
  if (cachedDates.value.lastFromDate !== settings.fromDate ||
    cachedDates.value.lastToDate !== settings.toDate) {
    cachedDates.value.fromDate = Date.parse(settings.fromDate)
    cachedDates.value.toDate = getMonthEndTimestamp(settings.toDate)
    cachedDates.value.lastFromDate = settings.fromDate
    cachedDates.value.lastToDate = settings.toDate
  }
  return { fromDate: cachedDates.value.fromDate, toDate: cachedDates.value.toDate }
}

const canBeStarted = computed(() =>
  selected.value.some((country) => country.found.length < country.nbNeeded),
)
const totalLocs = computed(() =>
  selected.value.reduce((sum, country) => sum + country.found.length, 0),
)

const startButtonText = computed(() => {
  if (state.started) {
    if (settings.scheduled.enabled && pauseCountdown.value > 0) {
      return `Pause in ${Math.ceil(pauseCountdown.value / 1000)}s`;
    }
    return 'Pause';
  }
  if (countdown.value > 0) return `Starting in ${Math.ceil(countdown.value / 1000)}s`;
  if (scheduledTaskTimer.value && settings.scheduled.interval) return `Restarting in ${Math.ceil(resumeCountdown.value / 1000)}s`;
  return 'Start';
})

// Handle scheduled task functionality
function handleScheduledChange(enabled: boolean) {
  if (!enabled && scheduledTaskTimer.value !== null) {
    state.started = false;
    clearTimeout(scheduledTaskTimer.value);
    scheduledTaskTimer.value = null;
    clearInterval(countdownTimer.value);
    countdownTimer.value = null;
    clearInterval(pauseCountdownTimer.value);
    pauseCountdownTimer.value = null;
    clearInterval(resumeCountdownTimer.value);
    resumeCountdownTimer.value = null;
    countdown.value = 0;
    pauseCountdown.value = 0;
    resumeCountdown.value = 0;
  }
}

function validateScheduleTime() {
  // Ensure after is at least 1 minute
  if (settings.scheduled.after < 0) {
    settings.scheduled.after = 0;
  }
  if (settings.scheduled.last < 0.1) {
    settings.scheduled.last = 0.1;
  }
  // Ensure interval is non-negative
  if (settings.scheduled.interval < 0) {
    settings.scheduled.interval = 0;
  }
}

function startScheduledTask() {
  // Clear any existing timers
  if (scheduledTaskTimer.value !== null) {
    clearTimeout(scheduledTaskTimer.value);
    clearInterval(scheduledTaskTimer.value);
    scheduledTaskTimer.value = null;
  }
  if (countdownTimer.value !== null) {
    clearInterval(countdownTimer.value);
    countdownTimer.value = null;
  }
  if (pauseCountdownTimer.value !== null) {
    clearInterval(pauseCountdownTimer.value);
    pauseCountdownTimer.value = null;
  }
  if (resumeCountdownTimer.value !== null) {
    clearInterval(resumeCountdownTimer.value);
    resumeCountdownTimer.value = null;
  }
  countdown.value = 0;
  pauseCountdown.value = 0;
  resumeCountdown.value = 0;

  // Convert minutes to milliseconds
  const afterDelay = settings.scheduled.after * 60 * 1000;
  const lastDuration = settings.scheduled.last * 60 * 1000;
  const intervalDelay = settings.scheduled.interval * 60 * 1000;

  // Set start countdown
  countdown.value = afterDelay;
  countdownTimer.value = window.setInterval(() => {
    countdown.value = Math.max(0, countdown.value - 1000);
    if (countdown.value === 0) {
      clearInterval(countdownTimer.value);
      countdownTimer.value = null;
    }
  }, 1000);

  // Delay the first task
  scheduledTaskTimer.value = window.setTimeout(() => {
    runAndSchedule(lastDuration, intervalDelay);
  }, afterDelay);
}

function runAndSchedule(lastDuration: number, intervalDelay: number) {
  if (!settings.scheduled.enabled || !canBeStarted.value) {
    state.started = false;
    return;
  }

  // Start the task
  state.started = true;
  generationStartTime.value = Date.now();
  startGeneration();

  // Set pause countdown
  pauseCountdown.value = lastDuration;
  pauseCountdownTimer.value = window.setInterval(() => {
    pauseCountdown.value = Math.max(0, pauseCountdown.value - 1000);
  }, 1000);

  // Schedule the stop and the next run
  scheduledTaskTimer.value = window.setTimeout(() => {
    state.started = false;
    clearInterval(pauseCountdownTimer.value);
    pauseCountdownTimer.value = null;
    pauseCountdown.value = 0;

    if (settings.scheduled.interval > 0) {
      // Set resume countdown
      resumeCountdown.value = intervalDelay;
      resumeCountdownTimer.value = window.setInterval(() => {
        resumeCountdown.value = Math.max(0, resumeCountdown.value - 1000);
        if (resumeCountdown.value === 0) {
          clearInterval(resumeCountdownTimer.value);
          resumeCountdownTimer.value = null;
        }
      }, 1000);

      // Schedule the next run
      scheduledTaskTimer.value = window.setTimeout(() => {
        runAndSchedule(lastDuration, intervalDelay);
      }, intervalDelay);
    } else {
      scheduledTaskTimer.value = null;
    }
  }, lastDuration);
}

// Watch for changes in scheduled settings
watch(() => settings.scheduled.enabled, (newVal) => {
  if (!newVal) {
    handleScheduledChange(false);
  }
});

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
  
  // Clear glify points for this polygon
  removeGlifyPointsForPolygon(polygon._leaflet_id)
  
  polygon.found.length = 0
  
  // Clear cached generator and its persisted state
  const generator = gridGenerators.get(polygon._leaflet_id)
  if (generator) {
    generator.clearSavedState()
    gridGenerators.delete(polygon._leaflet_id)
  }
}

function clearAllLocations() {
  for (const polygon of selected.value) {
    polygon.found.length = 0
    
    // Clear cached generators and their persisted states
    const generator = gridGenerators.get(polygon._leaflet_id)
    if (generator) {
      generator.clearSavedState()
      gridGenerators.delete(polygon._leaflet_id)
    }
  }
  clearMarkers()
}

// Generate panorama URL for a given location
function openPanorama(location: Panorama) {
  const heading = location.heading ?? 0
  const pitch = location.pitch ?? 0
  const url = `https://map.baidu.com/?newmap=1&shareurl=1&panotype=street&l=21&tn=B_NORMAL_MAP&sc=0&panoid=${location.panoId}&heading=${heading}&pitch=${pitch}&pid=${location.panoId}`
  window.open(url, '_blank')
}

// Handle high performance mode toggle
function handleGlifyToggle() {
  if (settings.markers.glify) {
    // Disable cluster when enabling high performance
    settings.markers.cluster = false
  }
  setGlifyMode(settings.markers.glify)
}

// Handle cluster toggle
function handleClusterToggle() {
  if (settings.markers.cluster) {
    // Disable high performance when enabling cluster
    settings.markers.glify = false
    setGlifyMode(false)
  }
  updateClusters()
}

onMounted(async () => {
  await initMap('map')
  toggleMap()

  registerGlifyClickHandler(openPanorama)
  
  // Restore high performance mode if it was enabled
  if (settings.markers.glify) {
    setGlifyMode(true)
  }
})

onBeforeUnmount(() => {
  if (scheduledTaskTimer.value !== null) {
    clearTimeout(scheduledTaskTimer.value);
    clearInterval(scheduledTaskTimer.value);
    scheduledTaskTimer.value = null;
  }
  if (countdownTimer.value !== null) {
    clearInterval(countdownTimer.value);
    countdownTimer.value = null;
  }
  countdown.value = 0;
  
  // Clean up grid generators
  for (const generator of gridGenerators.values()) {
    generator.clearSavedState()
  }
  gridGenerators.clear()
})

// Process
document.onkeydown = (event) => {
  const target = event.target as HTMLInputElement
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' && target.type === 'text') return

  if (event.key === ' ') {
    handleClickStart()
  }
}

async function startGeneration() {
  if (!canBeStarted.value) return;

  state.started = true;
  generationStartTime.value = Date.now();
  await start();
}

const handleClickStart = async () => {
  if (!state.started) {
    if (settings.scheduled.enabled) {
      // If there's a scheduled task, we either start it or resume it
      if (scheduledTaskTimer.value === null) {
        startScheduledTask();
      }
    } else {
      await startGeneration();
    }
  } else {
    // Manually stopping the task
    state.started = false;
    if (scheduledTaskTimer.value !== null) {
      clearTimeout(scheduledTaskTimer.value);
      scheduledTaskTimer.value = null;
    }
    if (countdownTimer.value !== null) {
      clearInterval(countdownTimer.value);
      countdownTimer.value = null;
    }
    if (pauseCountdownTimer.value !== null) {
      clearInterval(pauseCountdownTimer.value);
      pauseCountdownTimer.value = null;
    }
    if (resumeCountdownTimer.value !== null) {
      clearInterval(resumeCountdownTimer.value);
      resumeCountdownTimer.value = null;
    }
    countdown.value = 0;
    pauseCountdown.value = 0;
    resumeCountdown.value = 0;
  }
}

async function start() {
  if (settings.oneCountryAtATime) {
    for (const polygon of selected.value) await generate(polygon as Polygon)
  } else {
    const tasks = []
    for (const polygon of selected.value) {
      // Grid strategy: one generator per polygon to avoid race conditions
      // Random strategy: multiple generators per polygon for parallel sampling
      const generatorCount = settings.strategy === 'grid' 
        ? 1 
        : Math.min(settings.numOfGenerators, 10)
      
      for (let i = 0; i < generatorCount; i++) {
        tasks.push(generate(polygon as Polygon))
      }
    }
    await Promise.all(tasks)
  }
  state.started = false
}

async function generate(polygon: Polygon) {
  if (settings.strategy === 'grid') {
    const chunkSize = settings.findRegions ? 1 : 75
    const batchSize = Math.max(chunkSize * 2, 150)
    
    polygon.isProcessing = true
    
    let gridGenerator = gridGenerators.get(polygon._leaflet_id)
    if (!gridGenerator) {
      gridGenerator = new GridGenerator(polygon, settings.radius)
      gridGenerators.set(polygon._leaflet_id, gridGenerator)
    }
    
    // Loop until target is reached
    while (polygon.found.length < polygon.nbNeeded) {
      if (!state.started) break
      
      // Use generator to stream coordinates in batches
      const batchGenerator = gridGenerator.generateBatch(batchSize)
      let hasMoreCoords = false
      
      for (const batch of batchGenerator) {
        if (!state.started) break
        if (polygon.found.length >= polygon.nbNeeded) break
        
        hasMoreCoords = true
        
        const chinaBatch = batch.filter((point) => isInChina(point.lng, point.lat))
        for (const locationGroup of chinaBatch.chunk(chunkSize)) {
          if (!state.started) break
          if (polygon.found.length >= polygon.nbNeeded) break
          await Promise.allSettled(locationGroup.map((l) => getLoc(l, polygon)))
        }
      }
      
      // If no new coordinates were generated in this iteration, brief pause before next cycle
      if (!hasMoreCoords && polygon.found.length < polygon.nbNeeded) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    polygon.isProcessing = false
    
    // Clean up generator when polygon is complete
    if (polygon.found.length >= polygon.nbNeeded) {
      gridGenerators.delete(polygon._leaflet_id)
    }
    
    return
  }

  while (polygon.found.length < polygon.nbNeeded) {
    if (!state.started) return
    polygon.isProcessing = true

    const randomCoords = []
    const n = Math.min(polygon.nbNeeded * 100, settings.speed)

    while (randomCoords.length < n) {
      const point = randomPointInPoly(polygon)
      if (
        booleanPointInPolygon([point.lng, point.lat], polygon.feature) &&
        isInChina(point.lng, point.lat)
      ) {
        randomCoords.push(point)
      }
    }

    const chunkSize = settings.findRegions ? 1 : 75
    for (const locationGroup of randomCoords.chunk(chunkSize)) {
      await Promise.allSettled(locationGroup.map((l) => getLoc(l, polygon)))
    }
  }
  polygon.isProcessing = false
}

function getPanoramaRequest(loc: LatLng): StreetViewLocationRequest {
  return {
    location: loc,
    radius: settings.radius,
  }
}

async function getLoc(loc: LatLng, polygon: Polygon) {
  if (!isInChina(loc.lng, loc.lat)) return false

  return StreetViewProviders.getPanorama('baidu', getPanoramaRequest(loc), async (res, status) => {
    if (status != StreetViewStatus.OK || !res || !res.location) return false

    if (settings.searchInDescription.enabled) {
      const descriptionMatchesSearch = searchInDescription(
        res.location,
        settings.searchInDescription,
      )
      if (!descriptionMatchesSearch) return false
    }

    if (settings.rejectNoDescription && !hasAnyDescription(res.location)) return false

    if (settings.findRegions) {
      settings.checkAllDates = false
      let i = 0
      while (i < polygon.found.length) {
        if (distanceBetween(polygon.found[i], loc) < settings.regionRadius * 1000) {
          return false
        }
        i++
      }
    }

    if (settings.filterByMinutes.enabled) {
      const panoMinutes =
        Number(res.location.pano.slice(16, 18)) * 60 + Number(res.location.pano.slice(18, 20))
      if (
        panoMinutes < settings.filterByMinutes.range[0] ||
        panoMinutes > settings.filterByMinutes.range[1]
      )
        return false
    }

    if (settings.randomInTimeline && res.time) {
      const randomIndex = Math.floor(Math.random() * res.time.length)
      const randomPano = res.time[randomIndex]
      const panoDate = findDateInObject(randomPano)
      const parsedDate = panoDate ? panoDate.getTime() : undefined
      if (parsedDate) {
        const { fromDate, toDate } = getCachedDates()
        if (parsedDate < fromDate || parsedDate > toDate)
          return false
      }
      getPano(randomPano.pano, polygon)
    }

    if (settings.checkAllDates && !settings.selectMonths && !settings.randomInTimeline) {
      if (!res.time?.length) return false
      const { fromDate, toDate } = getCachedDates()
      let dateWithin = false
      for (const timelineLoc of res.time) {
        const date = findDateInObject(timelineLoc)
        const iDate = parseDate(date)
        if (iDate >= fromDate && iDate <= toDate) {
          dateWithin = true
          getPano(timelineLoc.pano, polygon)
        }
      }
      if (!dateWithin) return false
    } else {
      if (settings.rejectDateless && !res.imageDate) return false
      if (res.imageDate) {
        const { fromDate, toDate } = getCachedDates()
        const date = Date.parse(res.imageDate)
        if (date < fromDate || date > toDate) {
          return false
        }
      }
      getPano(res.location.pano, polygon)
    }

    return true
  })
}

async function isPanoGood(pano: StreetViewPanoramaData) {
  if (!pano.location) return false

  if (settings.rejectRoadName && pano.location.road) return false
  if (settings.rejectNoDescription && !hasAnyDescription(pano.location)) return false

  if (settings.filterByLinksLength.enabled) {
    const links = pano.links ?? []
    if (
      links.length < settings.filterByLinksLength.range[0] ||
      links.length > settings.filterByLinksLength.range[1]
    )
      return false
  }

  if (settings.filterByAltitude.enabled) {
    if (
      pano.location.altitude != null &&
      (pano.location.altitude < settings.filterByAltitude.range[0] ||
        pano.location.altitude > settings.filterByAltitude.range[1])
    )
      return false
  }

  if (settings.getCurve) {
    const links = pano.links ?? []
    if (!isAcceptableCurve(links, settings.minCurveAngle)) return false
  }

  if (settings.findByTileColor.enabled) {
    const latLng = pano.location.latLng
    if (!latLng) return false
    const anyMatch = await getTileColorPresence(
      { lat: latLng.lat(), lng: latLng.lng() },
      settings.findByTileColor,
    )
    if (!anyMatch) return false
  }

  if (settings.rejectDateless && !pano.imageDate) return false

  const { fromDate, toDate } = getCachedDates()
  const locDate = Date.parse(pano.imageDate ?? '')
  const fromMonth = settings.fromMonth
  const toMonth = settings.toMonth
  const fromYear = settings.fromYear
  const toYear = settings.toYear

  if (!settings.selectMonths && !settings.checkAllDates) {
    if (locDate < fromDate || locDate > toDate) return false
  }

  if (settings.onlyOneInTimeframe) {
    if (!pano.time?.length) return false
    for (const loc of pano.time) {
      if (loc.pano == pano.location?.pano) continue
      const date = findDateInObject(loc)
      const iDate = parseDate(date)
      if (iDate >= fromDate && iDate <= toDate) return false
    }
  }

  if (settings.checkAllDates && !settings.selectMonths) {
    if (!pano.time?.length) return false

    let dateWithin = false
    for (let i = 0; i < pano.time.length; i++) {
      const timeframeDate = findDateInObject(pano.time[i])
      const iDate = parseDate(timeframeDate)

      if (iDate >= fromDate && iDate <= toDate) {
        dateWithin = true
        break
      }
    }
    if (!dateWithin) return false
  }

  if (settings.selectMonths) {
    if (!pano.time?.length) return false
    let dateWithin = false

    if (settings.checkAllDates) {
      for (let i = 0; i < pano.time.length; i++) {
        const timeframeDate = findDateInObject(pano.time[i])
        const { month: iDateMonth, year: iDateYear } = extractMonthYear(timeframeDate)

        if (fromMonth <= toMonth) {
          if (
            iDateMonth >= fromMonth &&
            iDateMonth <= toMonth &&
            iDateYear >= fromYear &&
            iDateYear <= toYear
          ) {
            dateWithin = true
            break
          }
        } else if (
          (iDateMonth >= fromMonth || iDateMonth <= toMonth) &&
          iDateYear >= fromYear &&
          iDateYear <= toYear
        ) {
          dateWithin = true
          break
        }
      }
      if (!dateWithin) return false
    } else if (pano.imageDate) {
      if (pano.imageDate.slice(0, 4) < fromYear || pano.imageDate.slice(0, 4) > toYear) return false
      if (fromMonth <= toMonth) {
        if (pano.imageDate.slice(5) < fromMonth || pano.imageDate.slice(5) > toMonth) return false
      } else if (pano.imageDate.slice(5) < fromMonth && pano.imageDate.slice(5) > toMonth) {
        return false
      }
    }
  }

  return true
}

function getPano(id: string, polygon: Polygon) {
  return getPanoDeep(id, polygon, 0)
}

function getPanoDeep(id: string, polygon: Polygon, depth: number) {
  if (!state.started) return
  if (depth > settings.linksDepth) return
  if (polygon.checkedPanos.has(id)) return
  else polygon.checkedPanos.add(id)

  StreetViewProviders.getPanorama('baidu', { pano: id }, async (pano, status) => {
    if (status == StreetViewStatus.UNKNOWN_ERROR) {
      polygon.checkedPanos.delete(id)
      return getPanoDeep(id, polygon, depth)
    } else if (status != StreetViewStatus.OK) return

    const inCountry = booleanPointInPolygon(
      [pano.location.latLng.lng(), pano.location.latLng.lat()],
      polygon.feature,
    )
    const isPanoGoodAndInCountry = (await isPanoGood(pano)) && inCountry

    if (settings.checkAllDates && !settings.selectMonths && pano.time) {
      const { fromDate, toDate } = getCachedDates()

      for (const loc of pano.time) {
        const date = findDateInObject(loc)
        const iDate = parseDate(date)
        if (iDate >= fromDate && iDate <= toDate) {
          // if date ranges from fromDate to toDate, set dateWithin to true and stop the loop
          getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1)
          // TODO: add settings.onlyOneLoc
          // if(settings.onlyOneLoc)break;
        }
      }
    }
    if (settings.checkLinks) {
      if (pano.links) {
        for (const loc of pano.links) {
          getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1)
        }
      }
      if (pano.time) {
        for (const loc of pano.time) {
          getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1)
        }
      }
    }
    if (isPanoGoodAndInCountry) {
      addLoc(pano, polygon)
    }
    return pano
  })
}

function addLoc(pano: StreetViewPanoramaData, polygon: Polygon) {
  let heading = 0
  if (settings.heading.adjust) {
    if (settings.heading.reference === 'forward') {
      heading = pano.tiles.centerHeading
    } else if (settings.heading.reference === 'backward') {
      heading = (pano.tiles.centerHeading + 180) % 360
    } else if (settings.heading.reference === 'link') {
      heading = pano.links.length > 0 ? (pano.links[0].heading ?? pano.tiles.centerHeading) : pano.tiles.centerHeading
    }
    if (settings.heading.randomInRange) {
      heading += randomInRange(settings.heading.range[0], settings.heading.range[1])
    } else {
      heading += Math.random() < 0.5 ? settings.heading.range[0] : settings.heading.range[1]
    }
  }

  let pitch = 0
  if (settings.pitch.adjust) {
    pitch = settings.pitch.randomInRange
      ? randomInRange(settings.pitch.range[0], settings.pitch.range[1])
      : Math.random() < 0.5
        ? settings.pitch.range[0]
        : settings.pitch.range[1]
  }

  let zoom = 0
  if (settings.zoom.adjust) {
    zoom = settings.zoom.randomInRange
      ? randomInRange(settings.zoom.range[0], settings.zoom.range[1])
      : Math.random() < 0.5
        ? settings.zoom.range[0]
        : settings.zoom.range[1]
  }

  const location: Panorama = {
    panoId: pano.location.pano,
    lat: pano.location.latLng.lat(),
    lng: pano.location.latLng.lng(),
    heading,
    pitch,
    zoom,
    country: pano.location.country,
    region: pano.location.region,
    locality: pano.location.locality,
    road: pano.location.road,
    imageDate: pano.imageDate,
    source: 'baidu_pano',
    links: [
      ...new Set(pano.links.map((loc) => loc.pano).concat((pano.time ?? []).map((loc) => loc.pano))),
    ].sort(),
    extra: {
      tags: ['baidu'],
    },
  }

  const index = location.links.indexOf(pano.location.pano)
  if (index != -1) location.links.splice(index, 1)

  const previousPano = pano.time?.[pano.time.length - 2]?.pano
  if (!previousPano) {
    location.update_type = 'newroad'
    location.extra.tags.push(location.update_type)
    return addLocation(location, polygon, icons.newLoc)
  }

  location.update_type = 'gen4update'
  location.extra.tags.push(location.update_type)
  return addLocation(location, polygon, icons.gen4)
}

function getIconForUpdateType(updateType: string): L.Icon {
  switch (updateType) {
    case 'newroad':
      return icons.newLoc
    default:
      return icons.gen4
  }
}

function updateImportedMarkersOpacity(value) {
  Object.values(markerLayers).forEach((group) => {
    group.eachLayer(marker => {
      if (marker.imported) {
        marker.setOpacity(value)
      }
    })
  })
}

function addLocation(
  location: Panorama,
  polygon: Polygon,
  iconType: L.Icon,
  addMarker: boolean = true,
  opacity: number = 1.0,
  imported: boolean = false,
) {
  if (allFoundPanoIds.has(location.panoId)) return
  allFoundPanoIds.add(location.panoId)

  let markerLayer = markerLayers['gen4']
  let markerType: MarkerLayersTypes = 'gen4'
  let zIndex = 1
  if (iconType === icons.newLoc) {
    markerLayer = markerLayers['newRoad']
    markerType = 'newRoad'
    zIndex = 2
  }

  if (polygon.found.length < polygon.nbNeeded) {
    polygon.found.push(location)
    
    addGlifyPoint(location, markerType, polygon._leaflet_id)
    
    if (settings.notification.enabled && !imported) {
      const elapsedTime = ((Date.now() - generationStartTime.value) / 1000).toFixed(1)
      if (settings.notification.anyLocation && polygon.found.length === 1) {
        sendNotifications(
          'Location Found',
          `Found first location in ${getPolygonName(polygon.feature.properties)} (${elapsedTime}s)`,
          false,
          null,
          location,
        )
      }
      if (settings.notification.onePolygonComplete && polygon.found.length >= polygon.nbNeeded) {
        sendNotifications(
          'Polygon Completed',
          `${getPolygonName(polygon.feature.properties)} has reached its goal (${elapsedTime}s)`,
          false,
          null,
        )
      }

      if (settings.notification.allPolygonsComplete) {
        const allComplete = selected.value.every((p) => p.found.length >= p.nbNeeded)
        if (allComplete) {
          sendNotifications(
            'Generation Completed',
            `All polygons have reached their goals (${elapsedTime}s)`,
            false,
            null,
          )
        }
      }
    }
    if (addMarker) {
      const marker = L.marker([location.lat, location.lng], {
        icon: iconType,
        forceZIndex: zIndex,
        opacity: opacity,
        contextmenu: true,
        contextmenuItems: [
          {
            text: 'Remove Marker',
            callback: () => {
              markerLayer.removeLayer(marker)
            }
          }
        ]
      })
        .on('click', () => {
          openPanorama(location)
        })
        .setZIndexOffset(zIndex)
        .addTo(markerLayer)
      marker.polygonID = polygon._leaflet_id
      marker.imported = imported
    }
  }
}

async function importLocations(e: Event, polygon: Polygon) {
  const input = e.target as HTMLInputElement
  if (!input.files) return

  for (const file of input.files) {
    const result = await readFileAsText(file)
    if (file.type == 'application/json') {
      let JSONResult
      try {
        JSONResult = JSON.parse(result)
        if (!JSONResult.customCoordinates) {
          throw Error
        }
      } catch (e) {
        alert('Invalid JSON.')
        console.error(e)
      }

      for (const location of JSONResult.customCoordinates) {
        if (!location.panoId || !location.lat || !location.lng) continue
        if (settings.checkImports) {
          for (const link of location.links) {
            if (!JSONResult.customCoordinates.some((loc: Panorama) => loc.panoId === link))
              getPano(link, polygon)
          }
        }
        const icon = settings.useUpdateTypeIconsOnImport &&
          location.update_type ?
          getIconForUpdateType(location.update_type) :
          icons.gen4
        addLocation(location, polygon, icon, settings.markersOnImport, settings.importedMarkersOpacity ?? 1.0, true)
      }
    } else {
      alert('Unknown file type: ' + file.type + '. Only JSON may be imported.')
    }
  }
}

async function changeLocationsCap() {
  const input = prompt('What would you like to set the locations cap to ?')
  if (input === null) return
  const newCap = Math.abs(parseInt(input))
  if (isNaN(newCap)) return

  for (const polygon of selected.value) {
    polygon.nbNeeded = newCap
  }
}

async function handleGeoJSONImport(data: GeoJSON.GeoJsonObject, name: string) {
  try {
    await importGeoJSONFromSearch(data, name)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    alert(`Failed to import location: ${message}`)
    console.error('GeoJSON import error:', err)
  }
}

async function handleImportSubdivisions(data: GeoJSON.FeatureCollection, countryName: string, countryCode: string) {
  if (countryCode.toLowerCase() !== 'cn') {
    alert('Only China (CN) subdivisions are supported.')
    return
  }

  try {
    const layerKey = `subdivisions_${countryCode.toLowerCase()}`
    const layerLabel = `${countryName}`

    // Add to availableLayers if not already present
    const existingLayer = availableLayers.value.find(layer => layer.key === layerKey)
    if (!existingLayer) {
      const newLayer: LayerMeta = {
        key: layerKey,
        label: layerLabel,
        source: data,
        visible: true
      }
      availableLayers.value.push(newLayer)

      // Load the layer on the map
      await toggleLayer(newLayer as LayerMeta)
    } else {
      // If layer exists, just toggle it on
      existingLayer.visible = true
      await toggleLayer(existingLayer as LayerMeta)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    alert(`Failed to import subdivisions: ${message}`)
    console.error('Subdivisions import error:', err)
  }
}

function handleSpeedInput(e: Event) {
  const target = e.target as HTMLInputElement
  const value = parseInt(target.value)
  if (!value || value < 1) settings.speed = 1
  else if (value > 1000) settings.speed = 1000
}

function handleRadiusInput(e: Event) {
  const target = e.target as HTMLInputElement
  const value = parseInt(target.value)
  if (!value || value < 10) settings.radius = 10
  else if (value > 1000000) settings.radius = 1000000
}

window.onbeforeunload = function () {
  if (totalLocs.value > 0) {
    return 'Are you sure you want to stop the generator ?'
  }
}

  // window.type = !0
  // not sure if really needed
  ; (function (global: typeof L.Marker | undefined) {
    const MarkerMixin = {
      _updateZIndex: function (offset: number) {
        // @ts-expect-error error
        this._icon.style.zIndex = this.options.forceZIndex
          ? // @ts-expect-error error
          this.options.forceZIndex + (this.options.zIndexOffset || 0)
          : // @ts-expect-error error
          this._zIndex + offset
      },
      setForceZIndex: function (forceZIndex?: number | null) {
        // @ts-expect-error error
        this.options.forceZIndex = forceZIndex ? forceZIndex : null
      },
    }
    if (global) global.include(MarkerMixin)
  })(L.Marker)

Array.prototype.chunk = function (n) {
  if (!this.length) {
    return []
  }
  return [this.slice(0, n)].concat(this.slice(n).chunk(n))
}
</script>

<style>
@import '@vueform/slider/themes/default.css';

:root {
  --bg-color: white;
  --text-color: black;
  --text-shadow: rgba(0, 0, 0, 0.2);
  --container-bg: rgba(255, 255, 255, 0.7);
  --leaflet-bg: #f0f0f0;
  --leaflet-control-bg: rgba(255, 255, 255, 0.6);
  --leaflet-control-color: black;
}

html.dark {
  --bg-color: #121212;
  --text-color: #eee;
  --text-shadow: rgba(255, 255, 255, 0.2);
  --container-bg: rgba(0, 0, 0, 0.7);
  --leaflet-bg: #2c2c2c;
  --leaflet-control-bg: rgba(0, 0, 0, 0.6);
  --leaflet-control-color: white;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.container {
  background: var(--container-bg);
  color: var(--text-color);
}

.logo {
  background: linear-gradient(270deg, #E412D2, #CA283F, #FF5F6D, #FFC371, #24AC20, #2880CA, #9A28CA);
  background-size: 600% 600%;
  animation: gradientFlow 8s ease infinite;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  font-weight: 500;
  text-shadow: 0 0 1px var(--text-shadow);
}

.tooltip {
  color: var(--text-color);
  background-color: var(--bg-color);
}

input,
select,
option {
  color: var(--text-color);
  background-color: var(--container-bg) !important;
}

.stroke-current {
  stroke: currentColor;
}

.leaflet-container {
  background-color: var(--leaflet-bg);
}

.leaflet-control-layers {
  background-color: var(--leaflet-control-bg);
  font-size: 10px;
  color: var(--text-color);
}

.slider-connects {
  background-color: rgba(0, 0, 0, 0.8);
}

.slider-tooltip {
  background-color: rgb(59, 59, 59);
  border: 1px solid black;
  font-size: 0.75rem;
  font-weight: 400;
  padding: 0px 4px;
}

#map {
  z-index: 0;
  height: 100vh;
}

/* Leaflet Controls */
#leaflet-ui {
  z-index: 99;
}

.leaflet-left .leaflet-control,
.leaflet-bottom .leaflet-control {
  margin-left: 4px;
  margin-bottom: 4px;
}

@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}
</style>
