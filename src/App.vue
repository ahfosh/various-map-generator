<template>
  <div id="map"></div>
  <div id="leaflet-ui"></div>
  <div class="absolute bottom-1 left-1/2 -translate-x-1/2 font-bold text-xs text-black">
    缩放：{{ currentZoom }}
  </div>
  <div class="settings-sidebar settings-sidebar--left">
    <div class="container shrink-0">
      <h1
        class="logo px-2 py-0.5 flex gap-0.5 items-center justify-center text-xl tracking-tighter"
      >
        百度街景
        <Spinner />生成器
      </h1>
    </div>
    <div class="flex flex-col gap-1">
      <div class="settings-panel">
        <div class="relative cursor-pointer" @click="panels.general = !panels.general">
          <h2>常规</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <Collapsible :is-open="panels.general" class="settings-panel-content">
          <div class="flex items-center justify-between ml-1 mr-1">
            主题：
            <select v-model="themeMode" class="w-22 ml-10">
              <option value="auto">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div class="flex items-center justify-between ml-1 mr-1">
            地图主题：
            <select
              v-model="settings.mapTheme"
              class="w-22 ml-2 text-xs"
              @change="toggleMapTheme(settings.mapTheme)"
            >
              <option value="default">默认</option>
              <option value="classic">经典</option>
              <option value="retro">复古</option>
              <option value="dark">深色</option>
              <option value="night">夜间</option>
              <option value="aubergine">茄紫</option>
            </select>
          </div>
          <div class="flex items-center justify-between ml-1 mr-1">
            覆盖层透明度：
            <Slider
              v-model="settings.coverage.opacity"
              class="w-41 mr-3"
              @update:modelValue="setCoverageLayerOpacity"
              :min="0"
              :max="1.0"
              :step="0.1"
              :showTooltip="'focus'"
              :format="(val) => Number(val).toFixed(1)"
            />
          </div>
        </Collapsible>
      </div>

      <div v-if="!state.started" class="settings-panel">
        <div class="relative cursor-pointer" @click="panels.layer = !panels.layer">
          <h2>图层</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>

        <Collapsible :is-open="panels.layer" class="settings-panel-content">
          <div class="relative">
            <GeoJSONSearch
              @import="handleGeoJSONImport"
              @importSubdivisions="handleImportSubdivisions"
            />
            <hr />
          </div>
          <div v-for="layer in availableLayers" :key="layer.key" class="flex gap-1 justify-between">
            <Checkbox
              v-model="layer.visible"
              @change="toggleLayer(layer as LayerMeta)"
              class="truncate"
            >
              <span class="truncate">{{ layer.label }}</span>
            </Checkbox>
            <div class="flex gap-1">
              <Button size="sm" @click="selectLayer(layer.key)">全选</Button>
              <Button size="sm" variant="danger" @click="deselectLayer(layer.key)">
                取消全选
              </Button>
              <Button squared size="sm" title="导出图层" @click="exportLayer(layer as LayerMeta)">
                <FileExportIcon class="w-5 h-5" />
              </Button>
            </div>
          </div>
          <input
            type="file"
            class="mr-auto mt-1"
            @change="importLayer"
            accept=".txt,.json,.geojson"
            multiple
          />
        </Collapsible>
      </div>

      <div v-if="!state.started" class="container shrink-0 font-bold text-center">{{ select }}</div>

      <div v-if="selected.length" class="settings-panel">
        <h2>中国区域（{{ selected.length }}）</h2>
        <div class="px-1">
          <Checkbox v-model="settings.markersOnImport" title="可能影响性能。">
            为导入的地点添加标记
          </Checkbox>
          <div v-if="settings.markersOnImport" class="ml-4">
            <label class="text-s"
              >标记透明度：{{ Math.round((settings.importedMarkersOpacity ?? 1.0) * 100) }}%</label
            >
            <Slider
              v-model="settings.importedMarkersOpacity"
              @input="updateImportedMarkersOpacity"
              :value="settings.importedMarkersOpacity ?? 1.0"
              :max="1.0"
              :step="0.01"
              :tooltips="false"
              :lazy="false"
              class="mt-1 w-full max-w-48"
            />
            <Checkbox
              v-model="settings.useUpdateTypeIconsOnImport"
              title="根据更新类型使用相应图标。"
              class="mt-2"
            >
              根据更新类型使用图标
            </Checkbox>
          </div>
          <Checkbox v-model="settings.checkImports" title="在导入地点周围搜索更多全景图。">
            检查导入的地点
          </Checkbox>
          <hr />
        </div>

        <div class="polygon-list settings-panel-content--scroll">
          <div v-for="polygon of selected" :key="polygon._leaflet_id" class="polygon-item">
            <Button size="sm" squared title="导入地点">
              <label class="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  hidden
                  @change="importLocations($event, polygon as Polygon)"
                />
                <FileImportIcon class="w-5 h-5" />
              </label>
            </Button>
            <span
              v-if="polygon.feature.properties.code"
              :class="`flag-icon flag-` + getFlagCountryCode(polygon.feature.properties.code)"
            ></span>
            <label class="polygon-name" @click="changePolygonName(polygon.feature.properties)">
              {{ getPolygonName(polygon.feature.properties) }}
            </label>
            <Spinner v-if="state.started && polygon.isProcessing" animate />

            <div class="polygon-counter">
              {{ polygon.found.length }}
              <span>/</span>
              <input
                type="number"
                :min="polygon.found ? polygon.found.length : 0"
                v-model="polygon.nbNeeded"
              />
            </div>

            <div class="polygon-actions">
              <Clipboard
                :data="[polygon as Polygon]"
                :disabled="!polygon.found.length"
                :mode="settings.panoId"
                :tag="settings.tag"
              />
              <ExportToJSON
                :data="[polygon as Polygon]"
                :disabled="!polygon.found.length"
                :mode="settings.panoId"
                :tag="settings.tag"
              />
              <ExportToCSV :data="[polygon as Polygon]" :disabled="!polygon.found.length" />
              <Button
                size="sm"
                squared
                variant="danger"
                :disabled="!polygon.found.length"
                title="删除该多边形的地点"
                @click="clearPolygon(polygon as Polygon)"
              >
                <TrashBinIcon class="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container shrink-0">
      <div class="flex items-center gap-2 p-1">
        <h2>导出全部（{{ totalLocs }}）</h2>
        <Button
          class="ml-auto"
          size="sm"
          title="修改所有选中区域的上限"
          @click="changeLocationsCap"
        >
          批量修改上限
        </Button>
        <div class="flex gap-1">
          <Clipboard
            :data="selected as Polygon[]"
            :disabled="!totalLocs"
            :mode="settings.panoId"
            :tag="settings.tag"
          />
          <ExportToJSON
            :data="selected as Polygon[]"
            :disabled="!totalLocs"
            :mode="settings.panoId"
            :tag="settings.tag"
          />
          <ExportToCSV :data="selected as Polygon[]" :disabled="!totalLocs" />
          <Button
            size="sm"
            squared
            variant="danger"
            :disabled="!totalLocs"
            title="删除所有地点"
            @click="clearAllLocations"
          >
            <TrashBinIcon class="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  </div>

  <div class="settings-sidebar settings-sidebar--right">
    <div class="flex flex-col gap-1">
      <div v-if="!state.started" class="settings-panel">
        <div
          class="relative cursor-pointer"
          @click="panels.generatorSettings = !panels.generatorSettings"
        >
          <h2>生成器设置</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <Collapsible :is-open="panels.generatorSettings" class="settings-panel-content pr-1">
          <div class="flex items-center justify-between">
            全景 ID：
            <select v-model="settings.panoId" class="w-24 ml-10">
              <option value="enable">启用</option>
              <option value="disable">禁用</option>
              <option value="prefix">前缀</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            策略：
            <select
              v-model="settings.strategy"
              class="w-24"
              title="随机：在多边形内生成随机坐标。网格：使用搜索半径以网格方式系统性地覆盖多边形。"
            >
              <option value="random">随机</option>
              <option value="grid">网格</option>
            </select>
          </div>

          <div class="flex justify-between">
            生成器数量：
            <div class="flex items-center gap-4">
              <input
                type="number"
                v-model.number="settings.numOfGenerators"
                min="1"
                max="10"
                class="w-8 h-5 px-2 py-1 border rounded text-right"
              />
              <Slider
                v-model="settings.numOfGenerators"
                range="true"
                :min="1"
                :max="10"
                :step="1"
                :tooltips="false"
                :lazy="false"
                class="w-30 mr-2"
              />
            </div>
          </div>

          <div class="flex justify-between">
            速度：
            <span>
              <input
                type="number"
                v-model.number="settings.speed"
                min="1"
                max="1000"
                @input="handleSpeedInput"
              />
              次尝试
            </span>
          </div>

          <div class="flex items-center justify-between">
            半径：
            <span>
              <input type="number" v-model.number="settings.radius" @change="handleRadiusInput" />
              m
            </span>
          </div>

          <Checkbox v-model="settings.oneCountryAtATime"> 每次只检查一个区域/多边形 </Checkbox>

          <div>
            <Checkbox v-model="settings.findRegions">地点之间的最小距离</Checkbox>
            <div v-if="settings.findRegions" class="ml-6">
              <input type="number" v-model.number="settings.regionRadius" /> <span> 公里 </span>
            </div>
          </div>

          <Checkbox v-model="settings.tag"> 为地点启用自动标签 </Checkbox>
        </Collapsible>
      </div>

      <div v-if="!state.started" class="settings-panel">
        <div
          class="cursor-pointer relative"
          @click="panels.coverageSettings = !panels.coverageSettings"
        >
          <h2>覆盖设置</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <Collapsible :is-open="panels.coverageSettings" class="settings-panel-content">
          <Checkbox v-model="settings.rejectDateless">拒绝无日期的地点</Checkbox>

          <Checkbox v-model="settings.rejectNoDescription"> 拒绝无描述的地点 </Checkbox>
          <Checkbox v-model="settings.rejectRoadName"> 拒绝有道路名称的地点 </Checkbox>

          <Checkbox
            v-model="settings.onlyOneInTimeframe"
            title="仅允许在时间范围内附近没有其他覆盖的地点。"
          >
            每个位置仅一个全景图
          </Checkbox>

          <Checkbox v-model="settings.checkLinks">检查链接的全景图</Checkbox>
          <div v-if="settings.checkLinks" class="flex items-center justify-between ml-6">
            深度：
            <div class="flex items-center gap-2">
              {{ settings.linksDepth }}
              <input type="range" v-model.number="settings.linksDepth" min="1" max="10" />
            </div>
          </div>

          <div v-if="!settings.selectMonths" class="flex flex-col gap-0.5">
            <div class="flex justify-between">
              起始：
              <input :type="'month'" v-model="settings.fromDate" min="2007-01" :max="currentDate" />
            </div>
            <div class="flex justify-between">
              截止：
              <input :type="'month'" v-model="settings.toDate" min="2007-01" :max="currentDate" />
            </div>
          </div>

          <div>
            <Checkbox v-model="settings.selectMonths">按月份筛选</Checkbox>
            <div v-if="settings.selectMonths" class="flex flex-col gap-0.5 ml-6">
              <div>
                从
                <select v-model="settings.fromMonth">
                  <option value="01">一月</option>
                  <option value="02">二月</option>
                  <option value="03">三月</option>
                  <option value="04">四月</option>
                  <option value="05">五月</option>
                  <option value="06">六月</option>
                  <option value="07">七月</option>
                  <option value="08">八月</option>
                  <option value="09">九月</option>
                  <option value="10">十月</option>
                  <option value="11">十一月</option>
                  <option value="12">十二月</option>
                </select>
                到
                <select v-model="settings.toMonth">
                  <option value="01">一月</option>
                  <option value="02">二月</option>
                  <option value="03">三月</option>
                  <option value="04">四月</option>
                  <option value="05">五月</option>
                  <option value="06">六月</option>
                  <option value="07">七月</option>
                  <option value="08">八月</option>
                  <option value="09">九月</option>
                  <option value="10">十月</option>
                  <option value="11">十一月</option>
                  <option value="12">十二月</option>
                </select>
              </div>
              <div>
                介于
                <input type="number" v-model.number="settings.fromYear" min="2007" />
                和
                <input type="number" v-model.number="settings.toYear" min="2007" />
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Checkbox v-model="settings.filterByMinutes.enabled">按分钟筛选</Checkbox>
            <Slider
              v-if="settings.filterByMinutes.enabled"
              v-model="settings.filterByMinutes.range"
              :min="0"
              :max="1439"
              :step="5"
              :showTooltip="'focus'"
              :range="true"
              class="w-full max-w-48"
              :format="
                (val) => {
                  const h = Math.floor(val / 60)
                    .toString()
                    .padStart(2, '0');
                  const m = Math.floor(val % 60)
                    .toString()
                    .padStart(2, '0');
                  return `${h}:${m}`;
                }
              "
            />
            <span v-if="settings.filterByMinutes.enabled" class="ml-2">
              {{
                Math.floor(settings.filterByMinutes.range[0] / 60)
                  .toString()
                  .padStart(2, '0')
              }}:{{ (settings.filterByMinutes.range[0] % 60).toString().padStart(2, '0') }}
              -
              {{
                Math.floor(settings.filterByMinutes.range[1] / 60)
                  .toString()
                  .padStart(2, '0')
              }}:{{ (settings.filterByMinutes.range[1] % 60).toString().padStart(2, '0') }}
            </span>
          </div>

          <Checkbox
            v-model="settings.checkAllDates"
            title="检查某地点的所有日期/全景图，而非仅默认的一个。对于已有覆盖的国家尤其有用，新日期可能尚未成为默认。生成已有覆盖的国家时可能会略微降低速度。"
          >
            检查所有日期</Checkbox
          >

          <Checkbox v-model="settings.randomInTimeline"> 在时间范围内随机选择日期 </Checkbox>
        </Collapsible>
      </div>

      <div v-if="!state.started" class="settings-panel settings">
        <div
          class="cursor-pointer relative"
          @click="panels.mapMakingSettings = !panels.mapMakingSettings"
        >
          <h2>地图制作设置</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>

        <Collapsible :is-open="panels.mapMakingSettings" class="settings-panel-content">
          <div class="flex items-center gap-1 relative">
            <Checkbox v-model="settings.searchInDescription.enabled">在全景描述中搜索 </Checkbox>
            <Tooltip>
              描述通常基于您的语言区域。<br />
              您可以输入多个以逗号分隔的搜索词。
            </Tooltip>
          </div>

          <div v-if="settings.searchInDescription.enabled" class="space-y-0.5 ml-6 py-1">
            <div class="flex justify-between items-center gap-1">
              <select v-model="settings.searchInDescription.filterType">
                <option value="include">包含</option>
                <option value="exclude">排除</option>
              </select>
              <input
                type="text"
                v-model.trim="settings.searchInDescription.searchTerms"
                class="w-full"
              />
            </div>

            <div class="flex justify-between items-center gap-2">
              <div class="flex items-center gap-1 relative">
                搜索模式
                <Tooltip>
                  <strong>搜索模式：</strong><br />
                  • <strong>包含</strong>：文本中任意位置<br />
                  • <strong>全词</strong>：精确匹配单词<br />
                  • <strong>分段匹配</strong>：精确匹配逗号分隔的段落<br />
                  （例如：901 N Main Ave, <strong>Springfield</strong>, Missouri）<br />
                  • <strong>开头匹配</strong>：单词开头<br />
                  • <strong>结尾匹配</strong>：单词结尾<br />
                </Tooltip>
              </div>
              <select v-model="settings.searchInDescription.searchMode">
                <option value="contains">包含</option>
                <option value="fullword">全词</option>
                <option value="sectionmatch">分段匹配</option>
                <option value="startswith">开头匹配</option>
                <option value="endswith">结尾匹配</option>
              </select>
            </div>
          </div>

          <Checkbox v-model="settings.findByTileColor.enabled">按瓦片颜色查找</Checkbox>
          <div v-if="settings.findByTileColor.enabled" class="space-y-0.5 ml-6 pb-1">
            <div class="flex justify-between items-center gap-2">
              包含/排除：
              <select v-model="settings.findByTileColor.filterType">
                <option value="include">包含</option>
                <option value="exclude">排除</option>
              </select>
            </div>
            <div class="flex justify-between items-center gap-2">
              瓦片提供方：
              <select v-model="settings.findByTileColor.tileProvider">
                <option value="gmaps">谷歌地图</option>
                <option value="osm">OSM</option>
              </select>
            </div>

            <div class="flex justify-between items-center gap-2">
              瓦片缩放级别：
              <span class="ml-auto">
                {{ settings.findByTileColor.zoom }}
              </span>
              <input
                type="range"
                v-model.number="settings.findByTileColor.zoom"
                min="13"
                max="19"
                step="1"
                title="瓦片缩放级别"
              />
            </div>

            <div class="flex justify-between items-center gap-2">
              运算符：
              <select v-model="settings.findByTileColor.operator">
                <option value="OR">OR</option>
                <option value="AND">AND</option>
              </select>
            </div>

            <div
              v-for="(tileColor, index) in settings.findByTileColor.tileColors[
                settings.findByTileColor.tileProvider
              ]"
              :key="index"
              :title="tileColor.label"
              class="flex items-center gap-2"
            >
              <Checkbox v-model="tileColor.active" class="hover:brightness-100! truncate">
                <span
                  class="h-4 min-w-8"
                  :style="{ backgroundColor: 'rgb(' + tileColor.colors[0] + ')' }"
                />
                <span class="truncate">{{ tileColor.label }}</span>
              </Checkbox>
              <div v-if="tileColor.threshold >= 0.01" class="flex items-center gap-2 ml-auto">
                <span>{{ (tileColor.threshold * 100).toFixed(0) }}%</span>
                <input
                  type="range"
                  v-model.number="tileColor.threshold"
                  min="0.01"
                  max="1"
                  step="0.01"
                  title="颜色占比阈值"
                />
              </div>
            </div>
          </div>

          <Checkbox v-model="settings.filterByLinksLength.enabled"> 按链接数量筛选 </Checkbox>
          <div v-if="settings.filterByLinksLength.enabled" class="ml-6">
            <label class="flex items-center justify-between">
              <div class="flex items-center gap-1 relative">
                范围
                <Tooltip>
                  0：球形全景/孤立点<br />
                  1：一个箭头（死胡同）<br />
                  &gt; 2：交叉路口
                </Tooltip>
              </div>
              <Slider
                v-model="settings.filterByLinksLength.range"
                :min="0"
                :max="5"
                tooltipPosition="bottom"
                class="w-32 pr-2"
              />
            </label>
          </div>

          <Checkbox v-model="settings.filterByAltitude.enabled"> 按海拔筛选</Checkbox>
          <div v-if="settings.filterByAltitude.enabled" class="ml-6">
            <label class="flex items-center justify-between">
              <div class="flex items-center gap-1 relative">米</div>
              <Slider
                v-if="settings.filterByAltitude.enabled"
                v-model="settings.filterByAltitude.range"
                :min="-200"
                :max="8848"
                :step="10"
                :showTooltip="'always'"
                :range="true"
                :format="(val) => `${Math.round(val)}m`"
                tooltipPosition="bottom"
                class="w-40 pr-2"
              />
            </label>
          </div>

          <Checkbox v-model="settings.getCurve"> 查找弯道地点 </Checkbox>

          <label v-if="settings.getCurve" class="ml-6 flex items-center justify-between">
            最小弯道角度（{{ settings.minCurveAngle }}°）
            <input type="range" v-model.number="settings.minCurveAngle" min="5" max="90" />
          </label>

          <Checkbox v-model="settings.heading.adjust">设置朝向</Checkbox>
          <div v-if="settings.heading.adjust" class="ml-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="settings.heading.reference" value="link" />
              沿道路方向
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="settings.heading.reference" value="forward" />
              朝向车头
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="settings.heading.reference" value="backward" />
              朝向车尾
            </label>
            <label class="flex items-center justify-between">
              偏差
              <Slider
                v-model="settings.heading.range"
                :min="-180"
                :max="180"
                tooltipPosition="bottom"
                class="w-32 pr-2"
              />
            </label>
            <small>0° 将直接指向道路方向。</small>
            <Checkbox v-model="settings.heading.randomInRange">范围内随机</Checkbox>
          </div>

          <div class="flex items-center justify-between">
            <Checkbox v-model="settings.pitch.adjust">设置俯仰角</Checkbox>
            <Slider
              v-if="settings.pitch.adjust"
              v-model="settings.pitch.range"
              :min="-90"
              :max="90"
              tooltipPosition="bottom"
              class="w-32 pr-2"
            />
          </div>
          <div v-if="settings.pitch.adjust" class="ml-6">
            <small>默认 0°。-90° 指向地面，+90° 指向天空</small>
            <Checkbox v-model="settings.pitch.randomInRange">范围内随机</Checkbox>
          </div>

          <div class="flex items-center justify-between">
            <Checkbox v-model="settings.zoom.adjust">设置缩放</Checkbox>
            <Slider
              v-if="settings.zoom.adjust"
              v-model="settings.zoom.range"
              :min="0"
              :max="4"
              :step="-1"
              tooltipPosition="bottom"
              class="w-32 pr-2"
            />
          </div>
          <Checkbox v-if="settings.zoom.adjust" v-model="settings.zoom.randomInRange" class="ml-6"
            >范围内随机
          </Checkbox>
        </Collapsible>
      </div>

      <div class="settings-panel">
        <div class="cursor-pointer relative" @click="panels.marker = !panels.marker">
          <h2>标记</h2>
          <ChevronDownIcon class="collapsible-indicator absolute top-0 right-0" />
        </div>
        <Collapsible :is-open="panels.marker" class="settings-panel-content">
          <Checkbox v-model="settings.markers.newRoad" v-on:change="updateMarkerLayers('newRoad')">
            <span class="h-3 w-3 bg-[#CA283F] rounded-full"></span>新路
          </Checkbox>
          <Checkbox v-model="settings.markers.gen4" @change="updateMarkerLayers('gen4')">
            <span class="h-3 w-3 bg-[#2880CA] rounded-full"></span>更新
          </Checkbox>
          <Checkbox
            v-model="settings.markers.cluster"
            v-on:change="handleClusterToggle"
            :disabled="settings.markers.glify"
            title="用于减少卡顿。高性能模式开启时禁用。"
          >
            <span class="marker-swatch marker-swatch-cluster"></span>
            聚合标记
          </Checkbox>
          <Checkbox
            v-model="settings.markers.glify"
            v-on:change="handleGlifyToggle"
            title="使用 WebGL 渲染大量点位。点位较多时可能卡顿，低配设备建议关闭并改用聚合标记。"
          >
            <span class="marker-swatch marker-swatch-glify"></span>
            高性能
          </Checkbox>
          <Button
            :disabled="!totalLocs"
            size="sm"
            variant="warning"
            class="mt-2 w-full justify-center flex items-center gap-1"
            title="清除标记（为提升性能，不会删除已生成的地点）"
            @click="clearMarkers"
          >
            <MarkerIcon class="w-5 h-5" />清除
          </Button>
        </Collapsible>
      </div>

      <Button
        v-if="canBeStarted"
        class="shrink-0"
        @click="handleClickStart"
        :variant="state.started ? 'danger' : 'primary'"
        title="空格键/回车键"
        >{{ startButtonText }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onMounted, computed, ref, onBeforeUnmount } from 'vue';
import { useStorage, useColorMode } from '@vueuse/core';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

import Slider from '@vueform/slider';
import Collapsible from '@/components/Elements/Collapsible.vue';
import Button from '@/components/Elements/Button.vue';
import Checkbox from '@/components/Elements/Checkbox.vue';
import Spinner from '@/components/Elements/Spinner.vue';
import Tooltip from '@/components/Elements/Tooltip.vue';
import Clipboard from '@/components/Clipboard.vue';
import ExportToJSON from '@/components/ExportToJSON.vue';
import ExportToCSV from '@/components/ExportToCSV.vue';
import GeoJSONSearch from '@/components/GeoJSONSearch.vue';
import FileImportIcon from '@/assets/icons/file-import.svg';
import FileExportIcon from '@/assets/icons/file-export.svg';
import MarkerIcon from '@/assets/icons/marker.svg';
import TrashBinIcon from '@/assets/icons/trash-bin.svg';
import ChevronDownIcon from '@/assets/icons/chevron-down.svg';
import { useStore } from '@/store';
import { settings } from '@/settings';

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
} from '@/map';

import { getTileColorPresence } from '@/composables/tileColorDetector';
import {
  randomPointInPoly,
  GridGenerator,
  resetPolygonSearchState,
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
} from '@/composables/utils.ts';
import StreetViewProviders from '@/providers';
import { generationConcurrency } from '@/concurrency';
import { getFlagCountryCode, isChinaCountryCode, isInChina } from '@/constants';
import {
  StreetViewStatus,
  type StreetViewLocationRequest,
  type StreetViewPanoramaData,
} from '@/streetview-types';

const { currentDate } = getCurrentDate();
const themeMode = useColorMode();

const panels = useStorage('map_generator__panels_v2', {
  general: false,
  layer: false,
  generatorSettings: false,
  coverageSettings: false,
  mapMakingSettings: false,
  marker: false,
});

const { selected, select, state } = useStore();
const allFoundPanoIds = new Set<string>();

// Grid generators cache - persist across pause/resume
const gridGenerators = new Map<number, GridGenerator>();

const cachedDates = ref({
  fromDate: Date.parse(settings.fromDate),
  toDate: getMonthEndTimestamp(settings.toDate),
  lastFromDate: settings.fromDate,
  lastToDate: settings.toDate,
});

function findDateInObject(obj: any): Date | null {
  for (const key in obj) {
    const value = obj[key];
    if (value instanceof Date) {
      return value;
    }
  }
  return null;
}

function getCachedDates() {
  if (
    cachedDates.value.lastFromDate !== settings.fromDate ||
    cachedDates.value.lastToDate !== settings.toDate
  ) {
    cachedDates.value.fromDate = Date.parse(settings.fromDate);
    cachedDates.value.toDate = getMonthEndTimestamp(settings.toDate);
    cachedDates.value.lastFromDate = settings.fromDate;
    cachedDates.value.lastToDate = settings.toDate;
  }
  return { fromDate: cachedDates.value.fromDate, toDate: cachedDates.value.toDate };
}

const canBeStarted = computed(() =>
  selected.value.some((country) => country.found.length < country.nbNeeded),
);
const totalLocs = computed(() =>
  selected.value.reduce((sum, country) => sum + country.found.length, 0),
);

const startButtonText = computed(() => (state.started ? '暂停' : '开始'));

function clearPolygon(polygon: Polygon) {
  Object.values(markerLayers).forEach((markerLayer) => {
    const toRemove = markerLayer.getLayers().filter((layer) => {
      const marker = layer as L.Marker;
      return marker.polygonID === polygon._leaflet_id;
    });
    toRemove.forEach((marker) => {
      markerLayer.removeLayer(marker);
    });
  });

  // Clear glify points for this polygon
  removeGlifyPointsForPolygon(polygon._leaflet_id);

  polygon.found.length = 0;
  resetPolygonSearchState(polygon);

  // Clear cached generator and its persisted state
  const generator = gridGenerators.get(polygon._leaflet_id);
  if (generator) {
    generator.clearSavedState();
    gridGenerators.delete(polygon._leaflet_id);
  }
}

function clearAllLocations() {
  for (const polygon of selected.value) {
    polygon.found.length = 0;
    resetPolygonSearchState(polygon);

    // Clear cached generators and their persisted states
    const generator = gridGenerators.get(polygon._leaflet_id);
    if (generator) {
      generator.clearSavedState();
      gridGenerators.delete(polygon._leaflet_id);
    }
  }
  clearMarkers();
}

// Generate panorama URL for a given location
function openPanorama(location: Panorama) {
  const heading = location.heading ?? 0;
  const pitch = location.pitch ?? 0;
  const url = `https://map.baidu.com/?newmap=1&shareurl=1&panotype=street&l=21&tn=B_NORMAL_MAP&sc=0&panoid=${location.panoId}&heading=${heading}&pitch=${pitch}&pid=${location.panoId}`;
  window.open(url, '_blank');
}

// Handle high performance mode toggle
function handleGlifyToggle() {
  if (settings.markers.glify) {
    // Disable cluster when enabling high performance
    settings.markers.cluster = false;
  }
  setGlifyMode(settings.markers.glify);
}

// Handle cluster toggle
function handleClusterToggle() {
  if (settings.markers.cluster) {
    // Disable high performance when enabling cluster
    settings.markers.glify = false;
    setGlifyMode(false);
  }
  updateClusters();
}

onMounted(async () => {
  await initMap('map');
  toggleMap();

  registerGlifyClickHandler(openPanorama);

  // Restore high performance mode if it was enabled
  if (settings.markers.glify) {
    setGlifyMode(true);
  }
});

onBeforeUnmount(() => {
  // Clean up grid generators
  for (const generator of gridGenerators.values()) {
    generator.clearSavedState();
  }
  gridGenerators.clear();
});

// Process
document.onkeydown = (event) => {
  const target = event.target as HTMLInputElement;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' && target.type === 'text') return;

  if (event.key === ' ') {
    handleClickStart();
  }
};

function getRequestChunkSize(): number {
  return settings.findRegions ? 1 : generationConcurrency.getChunkSize();
}

async function startGeneration() {
  if (!canBeStarted.value) return;

  generationConcurrency.reset();
  state.started = true;
  await start();
}

const handleClickStart = async () => {
  if (!state.started) {
    await startGeneration();
  } else {
    state.started = false;
  }
};

async function start() {
  if (settings.oneCountryAtATime) {
    for (const polygon of selected.value) await generate(polygon as Polygon);
  } else {
    const tasks = [];
    for (const polygon of selected.value) {
      // Grid strategy: one generator per polygon to avoid race conditions
      // Random strategy: multiple generators per polygon for parallel sampling
      const generatorCount =
        settings.strategy === 'grid' ? 1 : Math.min(settings.numOfGenerators, 10);

      for (let i = 0; i < generatorCount; i++) {
        tasks.push(generate(polygon as Polygon));
      }
    }
    await Promise.all(tasks);
  }
  state.started = false;
}

async function generate(polygon: Polygon) {
  if (settings.strategy === 'grid') {
    const chunkSize = getRequestChunkSize();
    const batchSize = Math.max(chunkSize * 2, 150);

    polygon.isProcessing = true;

    let gridGenerator = gridGenerators.get(polygon._leaflet_id);
    if (!gridGenerator) {
      gridGenerator = new GridGenerator(polygon, settings.radius);
      gridGenerators.set(polygon._leaflet_id, gridGenerator);
    }

    // Loop until target is reached
    while (polygon.found.length < polygon.nbNeeded) {
      if (!state.started) break;

      // Use generator to stream coordinates in batches
      const batchGenerator = gridGenerator.generateBatch(batchSize);
      let hasMoreCoords = false;

      for (const batch of batchGenerator) {
        if (!state.started) break;
        if (polygon.found.length >= polygon.nbNeeded) break;

        hasMoreCoords = true;

        const chinaBatch = batch.filter((point) => isInChina(point.lng, point.lat));
        for (const locationGroup of chinaBatch.chunk(chunkSize)) {
          if (!state.started) break;
          if (polygon.found.length >= polygon.nbNeeded) break;
          await Promise.allSettled(locationGroup.map((l) => getLoc(l, polygon)));
        }
      }

      // If no new coordinates were generated in this iteration, brief pause before next cycle
      if (!hasMoreCoords && polygon.found.length < polygon.nbNeeded) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    polygon.isProcessing = false;

    // Clean up generator when polygon is complete
    if (polygon.found.length >= polygon.nbNeeded) {
      gridGenerators.delete(polygon._leaflet_id);
    }

    return;
  }

  while (polygon.found.length < polygon.nbNeeded) {
    if (!state.started) return;
    polygon.isProcessing = true;

    const randomCoords = [];
    const n = Math.min(polygon.nbNeeded * 100, settings.speed);

    while (randomCoords.length < n) {
      const point = randomPointInPoly(polygon);
      if (
        booleanPointInPolygon([point.lng, point.lat], polygon.feature) &&
        isInChina(point.lng, point.lat)
      ) {
        randomCoords.push(point);
      }
    }

    const chunkSize = getRequestChunkSize();
    for (const locationGroup of randomCoords.chunk(chunkSize)) {
      await Promise.allSettled(locationGroup.map((l) => getLoc(l, polygon)));
    }
  }
  polygon.isProcessing = false;
}

function getPanoramaRequest(loc: LatLng): StreetViewLocationRequest {
  return {
    location: loc,
    radius: settings.radius,
  };
}

async function getLoc(loc: LatLng, polygon: Polygon) {
  if (!isInChina(loc.lng, loc.lat)) return false;

  return StreetViewProviders.getPanorama(getPanoramaRequest(loc), async (res, status) => {
    if (status === StreetViewStatus.UNKNOWN_ERROR) {
      generationConcurrency.recordError();
      return false;
    }
    if (status != StreetViewStatus.OK || !res || !res.location) {
      generationConcurrency.recordSuccess();
      return false;
    }
    generationConcurrency.recordSuccess();

    if (settings.searchInDescription.enabled) {
      const descriptionMatchesSearch = searchInDescription(
        res.location,
        settings.searchInDescription,
      );
      if (!descriptionMatchesSearch) return false;
    }

    if (settings.rejectNoDescription && !hasAnyDescription(res.location)) return false;

    if (settings.findRegions) {
      settings.checkAllDates = false;
      let i = 0;
      while (i < polygon.found.length) {
        if (distanceBetween(polygon.found[i], loc) < settings.regionRadius * 1000) {
          return false;
        }
        i++;
      }
    }

    if (settings.filterByMinutes.enabled) {
      const panoMinutes =
        Number(res.location.pano.slice(16, 18)) * 60 + Number(res.location.pano.slice(18, 20));
      if (
        panoMinutes < settings.filterByMinutes.range[0] ||
        panoMinutes > settings.filterByMinutes.range[1]
      )
        return false;
    }

    if (settings.randomInTimeline && res.time) {
      const randomIndex = Math.floor(Math.random() * res.time.length);
      const randomPano = res.time[randomIndex];
      const panoDate = findDateInObject(randomPano);
      const parsedDate = panoDate ? panoDate.getTime() : undefined;
      if (parsedDate) {
        const { fromDate, toDate } = getCachedDates();
        if (parsedDate < fromDate || parsedDate > toDate) return false;
      }
      getPano(randomPano.pano, polygon);
    }

    if (settings.checkAllDates && !settings.selectMonths && !settings.randomInTimeline) {
      if (!res.time?.length) return false;
      const { fromDate, toDate } = getCachedDates();
      let dateWithin = false;
      for (const timelineLoc of res.time) {
        const date = findDateInObject(timelineLoc);
        const iDate = parseDate(date);
        if (iDate >= fromDate && iDate <= toDate) {
          dateWithin = true;
          getPano(timelineLoc.pano, polygon);
        }
      }
      if (!dateWithin) return false;
    } else {
      if (settings.rejectDateless && !res.imageDate) return false;
      if (res.imageDate) {
        const { fromDate, toDate } = getCachedDates();
        const date = Date.parse(res.imageDate);
        if (date < fromDate || date > toDate) {
          return false;
        }
      }
      getPano(res.location.pano, polygon);
    }

    return true;
  });
}

async function isPanoGood(pano: StreetViewPanoramaData) {
  if (!pano.location) return false;

  if (settings.rejectRoadName && pano.location.road) return false;
  if (settings.rejectNoDescription && !hasAnyDescription(pano.location)) return false;

  if (settings.filterByLinksLength.enabled) {
    const links = pano.links ?? [];
    if (
      links.length < settings.filterByLinksLength.range[0] ||
      links.length > settings.filterByLinksLength.range[1]
    )
      return false;
  }

  if (settings.filterByAltitude.enabled) {
    if (
      pano.location.altitude != null &&
      (pano.location.altitude < settings.filterByAltitude.range[0] ||
        pano.location.altitude > settings.filterByAltitude.range[1])
    )
      return false;
  }

  if (settings.getCurve) {
    const links = pano.links ?? [];
    if (!isAcceptableCurve(links, settings.minCurveAngle)) return false;
  }

  if (settings.findByTileColor.enabled) {
    const latLng = pano.location.latLng;
    if (!latLng) return false;
    const anyMatch = await getTileColorPresence(
      { lat: latLng.lat(), lng: latLng.lng() },
      settings.findByTileColor,
    );
    if (!anyMatch) return false;
  }

  if (settings.rejectDateless && !pano.imageDate) return false;

  const { fromDate, toDate } = getCachedDates();
  const locDate = Date.parse(pano.imageDate ?? '');
  const fromMonth = settings.fromMonth;
  const toMonth = settings.toMonth;
  const fromYear = settings.fromYear;
  const toYear = settings.toYear;

  if (!settings.selectMonths && !settings.checkAllDates) {
    if (locDate < fromDate || locDate > toDate) return false;
  }

  if (settings.onlyOneInTimeframe) {
    if (!pano.time?.length) return false;
    for (const loc of pano.time) {
      if (loc.pano == pano.location?.pano) continue;
      const date = findDateInObject(loc);
      const iDate = parseDate(date);
      if (iDate >= fromDate && iDate <= toDate) return false;
    }
  }

  if (settings.checkAllDates && !settings.selectMonths) {
    if (!pano.time?.length) return false;

    let dateWithin = false;
    for (let i = 0; i < pano.time.length; i++) {
      const timeframeDate = findDateInObject(pano.time[i]);
      const iDate = parseDate(timeframeDate);

      if (iDate >= fromDate && iDate <= toDate) {
        dateWithin = true;
        break;
      }
    }
    if (!dateWithin) return false;
  }

  if (settings.selectMonths) {
    if (!pano.time?.length) return false;
    let dateWithin = false;

    if (settings.checkAllDates) {
      for (let i = 0; i < pano.time.length; i++) {
        const timeframeDate = findDateInObject(pano.time[i]);
        const { month: iDateMonth, year: iDateYear } = extractMonthYear(timeframeDate);

        if (fromMonth <= toMonth) {
          if (
            iDateMonth >= fromMonth &&
            iDateMonth <= toMonth &&
            iDateYear >= fromYear &&
            iDateYear <= toYear
          ) {
            dateWithin = true;
            break;
          }
        } else if (
          (iDateMonth >= fromMonth || iDateMonth <= toMonth) &&
          iDateYear >= fromYear &&
          iDateYear <= toYear
        ) {
          dateWithin = true;
          break;
        }
      }
      if (!dateWithin) return false;
    } else if (pano.imageDate) {
      if (pano.imageDate.slice(0, 4) < fromYear || pano.imageDate.slice(0, 4) > toYear)
        return false;
      if (fromMonth <= toMonth) {
        if (pano.imageDate.slice(5) < fromMonth || pano.imageDate.slice(5) > toMonth) return false;
      } else if (pano.imageDate.slice(5) < fromMonth && pano.imageDate.slice(5) > toMonth) {
        return false;
      }
    }
  }

  return true;
}

function getPano(id: string, polygon: Polygon) {
  return getPanoDeep(id, polygon, 0);
}

function getPanoDeep(id: string, polygon: Polygon, depth: number) {
  if (!state.started) return;
  if (depth > settings.linksDepth) return;
  if (polygon.checkedPanos.has(id)) return;
  else polygon.checkedPanos.add(id);

  StreetViewProviders.getPanorama({ pano: id }, async (pano, status) => {
    if (status == StreetViewStatus.UNKNOWN_ERROR) {
      polygon.checkedPanos.delete(id);
      generationConcurrency.recordError();
      const delay = generationConcurrency.getBackoffMs();
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return getPanoDeep(id, polygon, depth);
    } else if (status != StreetViewStatus.OK) {
      generationConcurrency.recordSuccess();
      return;
    }
    generationConcurrency.recordSuccess();

    const inCountry = booleanPointInPolygon(
      [pano.location.latLng.lng(), pano.location.latLng.lat()],
      polygon.feature,
    );
    const isPanoGoodAndInCountry = (await isPanoGood(pano)) && inCountry;

    if (settings.checkAllDates && !settings.selectMonths && pano.time) {
      const { fromDate, toDate } = getCachedDates();

      for (const loc of pano.time) {
        const date = findDateInObject(loc);
        const iDate = parseDate(date);
        if (iDate >= fromDate && iDate <= toDate) {
          // if date ranges from fromDate to toDate, set dateWithin to true and stop the loop
          getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1);
        }
      }
    }
    if (settings.checkLinks) {
      if (pano.links) {
        for (const loc of pano.links) {
          getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1);
        }
      }
      if (pano.time) {
        for (const loc of pano.time) {
          getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1);
        }
      }
    }
    if (isPanoGoodAndInCountry) {
      addLoc(pano, polygon);
    }
    return pano;
  });
}

function addLoc(pano: StreetViewPanoramaData, polygon: Polygon) {
  let heading = 0;
  if (settings.heading.adjust) {
    if (settings.heading.reference === 'forward') {
      heading = pano.tiles.centerHeading;
    } else if (settings.heading.reference === 'backward') {
      heading = (pano.tiles.centerHeading + 180) % 360;
    } else if (settings.heading.reference === 'link') {
      heading =
        pano.links.length > 0
          ? (pano.links[0].heading ?? pano.tiles.centerHeading)
          : pano.tiles.centerHeading;
    }
    if (settings.heading.randomInRange) {
      heading += randomInRange(settings.heading.range[0], settings.heading.range[1]);
    } else {
      heading += Math.random() < 0.5 ? settings.heading.range[0] : settings.heading.range[1];
    }
  }

  let pitch = 0;
  if (settings.pitch.adjust) {
    pitch = settings.pitch.randomInRange
      ? randomInRange(settings.pitch.range[0], settings.pitch.range[1])
      : Math.random() < 0.5
        ? settings.pitch.range[0]
        : settings.pitch.range[1];
  }

  let zoom = 0;
  if (settings.zoom.adjust) {
    zoom = settings.zoom.randomInRange
      ? randomInRange(settings.zoom.range[0], settings.zoom.range[1])
      : Math.random() < 0.5
        ? settings.zoom.range[0]
        : settings.zoom.range[1];
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
      ...new Set(
        pano.links.map((loc) => loc.pano).concat((pano.time ?? []).map((loc) => loc.pano)),
      ),
    ].sort(),
    extra: {
      tags: ['baidu'],
    },
  };

  const index = location.links.indexOf(pano.location.pano);
  if (index != -1) location.links.splice(index, 1);

  const previousPano = pano.time?.[pano.time.length - 2]?.pano;
  if (!previousPano) {
    location.update_type = 'newroad';
    location.extra.tags.push(location.update_type);
    return addLocation(location, polygon, icons.newLoc);
  }

  location.update_type = 'gen4update';
  location.extra.tags.push(location.update_type);
  return addLocation(location, polygon, icons.gen4);
}

function getIconForUpdateType(updateType: string): L.Icon {
  switch (updateType) {
    case 'newroad':
      return icons.newLoc;
    default:
      return icons.gen4;
  }
}

function updateImportedMarkersOpacity(value) {
  Object.values(markerLayers).forEach((group) => {
    group.eachLayer((marker) => {
      if (marker.imported) {
        marker.setOpacity(value);
      }
    });
  });
}

function addLocation(
  location: Panorama,
  polygon: Polygon,
  iconType: L.Icon,
  addMarker: boolean = true,
  opacity: number = 1.0,
  imported: boolean = false,
) {
  if (allFoundPanoIds.has(location.panoId)) return;
  allFoundPanoIds.add(location.panoId);

  let markerLayer = markerLayers['gen4'];
  let markerType: MarkerLayersTypes = 'gen4';
  let zIndex = 1;
  if (iconType === icons.newLoc) {
    markerLayer = markerLayers['newRoad'];
    markerType = 'newRoad';
    zIndex = 2;
  }

  if (polygon.found.length < polygon.nbNeeded) {
    polygon.found.push(location);

    addGlifyPoint(location, markerType, polygon._leaflet_id);

    if (addMarker && !settings.markers.glify) {
      const marker = L.marker([location.lat, location.lng], {
        icon: iconType,
        forceZIndex: zIndex,
        opacity: opacity,
        contextmenu: true,
        contextmenuItems: [
          {
            text: '移除标记',
            callback: () => {
              markerLayer.removeLayer(marker);
            },
          },
        ],
      })
        .on('click', () => {
          openPanorama(location);
        })
        .setZIndexOffset(zIndex)
        .addTo(markerLayer);
      marker.polygonID = polygon._leaflet_id;
      marker.imported = imported;
    }
  }
}

async function importLocations(e: Event, polygon: Polygon) {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;

  for (const file of input.files) {
    const result = await readFileAsText(file);
    if (file.type == 'application/json') {
      let JSONResult;
      try {
        JSONResult = JSON.parse(result);
        if (!JSONResult.customCoordinates) {
          throw Error;
        }
      } catch (e) {
        alert('JSON 无效。');
        console.error(e);
      }

      for (const location of JSONResult.customCoordinates) {
        if (!location.panoId || !location.lat || !location.lng) continue;
        if (settings.checkImports) {
          for (const link of location.links) {
            if (!JSONResult.customCoordinates.some((loc: Panorama) => loc.panoId === link))
              getPano(link, polygon);
          }
        }
        const icon =
          settings.useUpdateTypeIconsOnImport && location.update_type
            ? getIconForUpdateType(location.update_type)
            : icons.gen4;
        addLocation(
          location,
          polygon,
          icon,
          settings.markersOnImport,
          settings.importedMarkersOpacity ?? 1.0,
          true,
        );
      }
    } else {
      alert('未知文件类型：' + file.type + '。仅支持导入 JSON。');
    }
  }
}

async function changeLocationsCap() {
  const input = prompt('要将地点上限设置为多少？');
  if (input === null) return;
  const newCap = Math.abs(parseInt(input));
  if (isNaN(newCap)) return;

  for (const polygon of selected.value) {
    polygon.nbNeeded = newCap;
  }
}

async function handleGeoJSONImport(data: GeoJSON.GeoJsonObject, name: string) {
  try {
    await importGeoJSONFromSearch(data, name);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    alert(`导入地点失败：${message}`);
    console.error('GeoJSON import error:', err);
  }
}

async function handleImportSubdivisions(
  data: GeoJSON.FeatureCollection,
  countryName: string,
  countryCode: string,
) {
  const normalizedCode = getFlagCountryCode(countryCode);
  if (!isChinaCountryCode(countryCode)) {
    alert('仅支持中国（CN）的行政区划。');
    return;
  }

  try {
    const layerKey = `subdivisions_${normalizedCode}`;
    const layerLabel = `${countryName}`;

    // Add to availableLayers if not already present
    const existingLayer = availableLayers.value.find((layer) => layer.key === layerKey);
    if (!existingLayer) {
      const newLayer: LayerMeta = {
        key: layerKey,
        label: layerLabel,
        source: data,
        visible: true,
      };
      availableLayers.value.push(newLayer);

      // Load the layer on the map
      await toggleLayer(newLayer as LayerMeta);
    } else {
      // If layer exists, just toggle it on
      existingLayer.visible = true;
      await toggleLayer(existingLayer as LayerMeta);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    alert(`导入行政区划失败：${message}`);
    console.error('Subdivisions import error:', err);
  }
}

function handleSpeedInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const value = parseInt(target.value);
  if (!value || value < 1) settings.speed = 1;
  else if (value > 1000) settings.speed = 1000;
}

function handleRadiusInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const value = parseInt(target.value);
  if (!value || value < 10) settings.radius = 10;
  else if (value > 1000000) settings.radius = 1000000;
}

window.onbeforeunload = function () {
  if (totalLocs.value > 0) {
    return '确定要停止生成器吗？';
  }
};

(function (global: typeof L.Marker | undefined) {
  const MarkerMixin = {
    _updateZIndex: function (offset: number) {
      // @ts-expect-error error
      this._icon.style.zIndex = this.options.forceZIndex
        ? // @ts-expect-error error
          this.options.forceZIndex + (this.options.zIndexOffset || 0)
        : // @ts-expect-error error
          this._zIndex + offset;
    },
    setForceZIndex: function (forceZIndex?: number | null) {
      // @ts-expect-error error
      this.options.forceZIndex = forceZIndex ? forceZIndex : null;
    },
  };
  if (global) global.include(MarkerMixin);
})(L.Marker);

Array.prototype.chunk = function (n) {
  if (!this.length) {
    return [];
  }
  return [this.slice(0, n)].concat(this.slice(n).chunk(n));
};
</script>

<style>
@import '@vueform/slider/themes/default.css';

:root {
  --bg-color: white;
  --text-color: black;
  --text-shadow: rgba(0, 0, 0, 0.2);
  --container-bg: rgba(255, 255, 255, 0.92);
  --leaflet-bg: #f0f0f0;
  --leaflet-control-bg: rgba(255, 255, 255, 0.6);
  --leaflet-control-color: black;
}

html.dark {
  --bg-color: #121212;
  --text-color: #eee;
  --text-shadow: rgba(255, 255, 255, 0.2);
  --container-bg: rgba(18, 18, 18, 0.92);
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
  contain: layout style;
}

.settings-sidebar {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: max-content;
  min-width: 18rem;
  max-width: min(80vw, calc(100vw - 0.5rem));
  max-height: calc(100vh - 0.5rem);
  overflow-y: auto;
  overflow-x: hidden;
}

.settings-sidebar--left {
  top: 0.25rem;
  left: 0.25rem;
}

.settings-sidebar--right {
  bottom: 0.25rem;
  right: 0.25rem;
}

@media (min-width: 640px) {
  .settings-sidebar--right {
    top: 0.25rem;
    bottom: auto;
  }
}

.settings-panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--container-bg);
  color: var(--text-color);
  contain: layout style;
}

.settings-panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.25rem;
}

.settings-panel-content--scroll {
  max-height: min(50vh, calc(100vh - 16rem));
  overflow-y: auto;
}

.logo {
  background: linear-gradient(90deg, #e412d2, #ca283f, #ff5f6d, #ffc371, #24ac20, #2880ca, #9a28ca);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  font-weight: 500;
}

.marker-swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
}

.marker-swatch-cluster {
  background: linear-gradient(90deg, #ff5f6d, #ffc371, #58cffb, #845ec2);
}

.marker-swatch-glify {
  background: linear-gradient(60deg, #2880ca, #9a28ca, #24ac20, #ca283f);
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
</style>
