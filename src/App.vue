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
          <div class="flex items-center justify-between ml-1 mr-1 gap-2">
            页面主题：
            <Segment
              :model-value="themeMode"
              :options="pageThemeOptions"
              @update:model-value="(v) => (themeMode = v)"
            />
          </div>
          <div class="flex items-center justify-between ml-1 mr-1 gap-2">
            地图主题：
            <Segment
              :model-value="settings.mapTheme"
              :options="mapThemeOptions"
              @update:model-value="onMapThemeChange"
            />
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

        <div class="polygon-list settings-panel-content--scroll">
          <div v-for="polygon of selected" :key="polygon._leaflet_id" class="polygon-item">
            <span
              v-if="polygon.feature?.properties?.code"
              :class="`flag-icon flag-` + getFlagCountryCode(polygon.feature.properties.code)"
            ></span>
            <label class="polygon-name" @click="changePolygonName(polygon.feature?.properties)">
              {{ getPolygonName(polygon.feature?.properties) }}
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
      <div class="settings-panel px-1 py-1">
        <div class="flex items-center gap-2">
          <h2>导入地点（{{ importedLocations.length }}）</h2>
          <Button size="sm" squared title="导入 JSON 地点" class="ml-auto">
            <label class="cursor-pointer">
              <input type="file" accept=".json,application/json" hidden @change="importLocations" />
              <FileImportIcon class="w-5 h-5" />
            </label>
          </Button>
          <Button
            size="sm"
            squared
            variant="danger"
            :disabled="!importedLocations.length"
            title="删除所有导入的地点"
            @click="clearImportedLocations"
          >
            <TrashBinIcon class="w-5 h-5" />
          </Button>
        </div>
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
      </div>

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
            :imported="importedLocations"
            :disabled="!totalLocs"
            :mode="settings.panoId"
            :tag="settings.tag"
          />
          <ExportToJSON
            :data="selected as Polygon[]"
            :imported="importedLocations"
            :disabled="!totalLocs"
            :mode="settings.panoId"
            :tag="settings.tag"
          />
          <ExportToCSV
            :data="selected as Polygon[]"
            :imported="importedLocations"
            :disabled="!totalLocs"
          />
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
          <Checkbox v-model="settings.autoUaTune" @change="handleAutoUaTuneChange">
            根据设备自动调整生成器
          </Checkbox>
          <div v-if="settings.uaProfileLabel" class="ml-6 text-xs opacity-80">
            当前设备：{{ settings.uaProfileLabel }}
          </div>

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

          <Checkbox v-model="settings.rejectNoDescription">拒绝无描述的地点</Checkbox>
          <Checkbox v-model="settings.rejectRoadName">拒绝有路名的地点</Checkbox>

          <Checkbox v-model="settings.rejectDateless">拒绝无日期的地点</Checkbox>
          <div class="flex flex-col gap-1">
            <Checkbox v-model="settings.filterCaptureDate">采集日期</Checkbox>
            <div
              v-if="settings.filterCaptureDate && !settings.selectMonths"
              class="flex flex-col gap-0.5 ml-6"
            >
              <div class="flex justify-between items-center gap-2">
                最早采集
                <input
                  type="month"
                  v-model="settings.captureFromDate"
                  min="2007-01"
                  :max="currentDate"
                />
              </div>
              <div class="flex justify-between items-center gap-2">
                最晚采集
                <input
                  type="month"
                  v-model="settings.captureToDate"
                  min="2007-01"
                  :max="currentDate"
                />
              </div>
            </div>
            <Checkbox v-model="settings.filterPublishDate">发布日期</Checkbox>
            <div
              v-if="settings.filterPublishDate && !settings.selectMonths"
              class="flex flex-col gap-0.5 ml-6"
            >
              <div class="flex justify-between items-center gap-2">
                最早发布
                <input
                  type="month"
                  v-model="settings.publishFromDate"
                  min="2007-01"
                  :max="currentDate"
                />
              </div>
              <div class="flex justify-between items-center gap-2">
                最晚发布
                <input
                  type="month"
                  v-model="settings.publishToDate"
                  min="2007-01"
                  :max="currentDate"
                />
              </div>
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
              百度街景的路名来自全景数据中的 Rname 字段。<br />
              您可以输入多个以逗号分隔的搜索词（支持中文路名）。
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
                  • <strong>包含</strong>：路名中任意位置<br />
                  • <strong>全词</strong>：精确匹配整段路名<br />
                  • <strong>分段匹配</strong>：精确匹配逗号分隔的段落<br />
                  （例如：北京市，<strong>朝阳区</strong>，建国路）<br />
                  • <strong>开头匹配</strong>：路名或词段开头<br />
                  • <strong>结尾匹配</strong>：路名或词段结尾<br />
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

          <Checkbox v-model="settings.filterByLinksLength.enabled"> 按链接数量筛选 </Checkbox>
          <div v-if="settings.filterByLinksLength.enabled" class="ml-6">
            <label class="flex items-center justify-between">
              <div class="flex items-center gap-1 relative">
                范围
                <Tooltip>
                  0：无邻接全景<br />
                  1：单条道路延伸<br />
                  &gt; 2：多向路口
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
            <small>0° 将直接指向邻接道路方向（DIR）。</small>
            <Checkbox v-model="settings.heading.randomInRange">范围内随机</Checkbox>
          </div>

          <div class="flex items-center justify-between">
            <Checkbox v-model="settings.pitch.adjust">设置俯仰角</Checkbox>
            <Slider
              v-if="settings.pitch.adjust"
              v-model="settings.pitch.range"
              :min="0"
              :max="90"
              :step="1"
              tooltipPosition="bottom"
              class="w-32 pr-2"
            />
          </div>
          <div v-if="settings.pitch.adjust" class="ml-6">
            <small>未调整时使用百度返回的默认俯仰角；可调范围 0°–90°</small>
            <Checkbox v-model="settings.pitch.randomInRange">范围内随机</Checkbox>
          </div>

          <div class="flex items-center justify-between">
            <Checkbox v-model="settings.fov.adjust">设置视野（FOV）</Checkbox>
            <Slider
              v-if="settings.fov.adjust"
              v-model="settings.fov.range"
              :min="10"
              :max="120"
              :step="5"
              tooltipPosition="bottom"
              class="w-32 pr-2"
            />
          </div>
          <div v-if="settings.fov.adjust" class="ml-6">
            <small>百度街景默认 90°；数值越小视野越窄（接近放大）</small>
            <Checkbox v-model="settings.fov.randomInRange">范围内随机</Checkbox>
          </div>
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
import Segment from '@/components/Elements/Segment.vue';
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
  removeGlifyPointByPanoId,
  removeGlifyPointsForImported,
  IMPORTED_LOCATIONS_POLYGON_ID,
  fitMapToLatLngs,
  type LayerMeta,
  type MarkerLayersTypes,
} from '@/map';

import {
  BAIDU_UPDATE_TYPES,
  buildPanoramaRecord,
  getPanoramaDateField,
  normalizeImportedPanorama,
  normalizeUpdateType,
} from '@/composables/baiduPanorama';
import { applyUaGeneratorProfile } from '@/composables/uaProfile';
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
  readFileAsText,
  getPolygonName,
  changePolygonName,
  getMonthEndTimestamp,
  getExclusionZones,
  clearExclusionZones,
  isInExclusionZone,
} from '@/composables/utils.ts';
import StreetViewProviders from '@/providers';
import { generationConcurrency } from '@/concurrency';
import { panoDateMetaCache } from '@/cache';
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

const pageThemeOptions = [
  { value: 'auto', label: '系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const mapThemeOptions = [
  { value: 'classic', label: '经典' },
  { value: 'dark', label: '深色' },
];

function onMapThemeChange(theme) {
  settings.mapTheme = theme;
  toggleMapTheme(theme);
}

const { selected, importedLocations, select, state } = useStore();
const importCheckedPanos = new Set<string>();
const allFoundPanoIds = new Set<string>();

// Grid generators cache - persist across pause/resume
const gridGenerators = new Map<number, GridGenerator>();

const cachedDateRanges = ref({
  captureFrom: Date.parse(settings.captureFromDate),
  captureTo: getMonthEndTimestamp(settings.captureToDate),
  lastCaptureFrom: settings.captureFromDate,
  lastCaptureTo: settings.captureToDate,
  publishFrom: Date.parse(settings.publishFromDate),
  publishTo: getMonthEndTimestamp(settings.publishToDate),
  lastPublishFrom: settings.publishFromDate,
  lastPublishTo: settings.publishToDate,
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

function getCachedCaptureDates() {
  const c = cachedDateRanges.value;
  if (c.lastCaptureFrom !== settings.captureFromDate || c.lastCaptureTo !== settings.captureToDate) {
    c.captureFrom = Date.parse(settings.captureFromDate);
    c.captureTo = getMonthEndTimestamp(settings.captureToDate);
    c.lastCaptureFrom = settings.captureFromDate;
    c.lastCaptureTo = settings.captureToDate;
  }
  return { fromDate: c.captureFrom, toDate: c.captureTo };
}

function getCachedPublishDates() {
  const c = cachedDateRanges.value;
  if (c.lastPublishFrom !== settings.publishFromDate || c.lastPublishTo !== settings.publishToDate) {
    c.publishFrom = Date.parse(settings.publishFromDate);
    c.publishTo = getMonthEndTimestamp(settings.publishToDate);
    c.lastPublishFrom = settings.publishFromDate;
    c.lastPublishTo = settings.publishToDate;
  }
  return { fromDate: c.publishFrom, toDate: c.publishTo };
}

function polygonStillNeedsLocations(polygon: Polygon) {
  return state.started && polygon.found.length < polygon.nbNeeded;
}

/**
 * Whether to deep-fetch a timeline entry. TimeLine has capture month only, not procdate.
 * Safe prunes:
 * - capture filter range
 * - capture > publishTo (procdate >= capture always)
 * - cached procDate outside publish range (TTL-backed meta)
 */
function shouldDeepFetchTimelinePano(timelineLoc: { pano?: string; date?: Date }) {
  const panoId = timelineLoc.pano;
  if (!panoId) return false;

  const filterCapture = settings.filterCaptureDate;
  const filterPublish = settings.filterPublishDate;
  const captureDate = findDateInObject(timelineLoc);
  const captureTs = captureDate ? parseDate(captureDate) : NaN;

  if (filterCapture && !settings.selectMonths && !Number.isNaN(captureTs)) {
    const { fromDate, toDate } = getCachedCaptureDates();
    if (captureTs < fromDate || captureTs > toDate) return false;
  }

  if (filterPublish && !settings.selectMonths) {
    const { fromDate: publishFrom, toDate: publishTo } = getCachedPublishDates();
    // Impossible: published before capture month
    if (!Number.isNaN(captureTs) && captureTs > publishTo) return false;

    const meta = panoDateMetaCache.get(panoId);
    if (meta?.procDate) {
      const t = Date.parse(meta.procDate);
      if (!Number.isNaN(t) && (t < publishFrom || t > publishTo)) return false;
    }
    if (meta?.imageDate && !Number.isNaN(Date.parse(meta.imageDate))) {
      const cap = Date.parse(meta.imageDate);
      // Same invariant with higher-resolution cached capture day
      if (cap > publishTo) return false;
    }
  }

  return true;
}

/** Skip network when persisted dates already prove date filters fail. */
function isRejectedByCachedDates(panoId: string): boolean {
  const filterCapture = settings.filterCaptureDate;
  const filterPublish = settings.filterPublishDate;
  if (!filterCapture && !filterPublish) return false;
  if (settings.selectMonths) return false;

  const meta = panoDateMetaCache.get(panoId);
  if (!meta) return false;

  if (filterCapture && meta.imageDate) {
    const t = Date.parse(meta.imageDate);
    const { fromDate, toDate } = getCachedCaptureDates();
    if (!Number.isNaN(t) && (t < fromDate || t > toDate)) return true;
  }

  if (filterPublish && meta.procDate) {
    const t = Date.parse(meta.procDate);
    const { fromDate, toDate } = getCachedPublishDates();
    if (!Number.isNaN(t) && (t < fromDate || t > toDate)) return true;
  }

  if (filterPublish && meta.imageDate && !meta.procDate) {
    const cap = Date.parse(meta.imageDate);
    const { toDate: publishTo } = getCachedPublishDates();
    if (!Number.isNaN(cap) && cap > publishTo) return true;
  }

  return false;
}

const canBeStarted = computed(() =>
  selected.value.some((country) => country.found.length < country.nbNeeded),
);
const totalLocs = computed(
  () =>
    selected.value.reduce((sum, country) => sum + country.found.length, 0) +
    importedLocations.value.length,
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
  clearExclusionZones(polygon);

  // Clear cached generator and its persisted state
  const generator = gridGenerators.get(polygon._leaflet_id);
  if (generator) {
    generator.clearSavedState();
    gridGenerators.delete(polygon._leaflet_id);
  }
}

function clearImportedLocations() {
  Object.values(markerLayers).forEach((markerLayer) => {
    const toRemove = markerLayer.getLayers().filter((layer) => {
      const marker = layer as L.Marker;
      return marker.imported;
    });
    toRemove.forEach((marker) => {
      markerLayer.removeLayer(marker);
    });
  });

  for (const location of importedLocations.value) {
    allFoundPanoIds.delete(location.panoId);
  }

  importedLocations.value = [];
  importCheckedPanos.clear();
  removeGlifyPointsForImported();
}

function clearAllLocations() {
  for (const polygon of selected.value) {
    polygon.found.length = 0;
    resetPolygonSearchState(polygon);
    clearExclusionZones(polygon);

    // Clear cached generators and their persisted states
    const generator = gridGenerators.get(polygon._leaflet_id);
    if (generator) {
      generator.clearSavedState();
      gridGenerators.delete(polygon._leaflet_id);
    }
  }
  clearImportedLocations();
  allFoundPanoIds.clear();
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

function handleAutoUaTuneChange() {
  if (settings.autoUaTune === false) return;

  applyUaGeneratorProfile(settings);
  setGlifyMode(settings.markers.glify);
  updateClusters();
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
  return generationConcurrency.getChunkSize();
}

function isSampleExcluded(point: LatLng, polygon: Polygon): boolean {
  return settings.findRegions && isInExclusionZone(point, polygon, settings.regionRadius);
}

function ensureExclusionZones(polygon: Polygon) {
  if (settings.findRegions) {
    getExclusionZones(polygon, settings.regionRadius);
  }
}

function resetGenerationState() {
  state.started = false;
  for (const polygon of selected.value) {
    polygon.isProcessing = false;
  }
}

async function startGeneration() {
  if (!canBeStarted.value) return;

  generationConcurrency.reset();
  state.started = true;

  try {
    await start();
  } catch (err) {
    console.error('Generation error:', err);
    const message = err instanceof Error ? err.message : '未知错误';
    alert(`生成器出错：${message}`);
  } finally {
    resetGenerationState();
  }
}

const handleClickStart = async () => {
  if (!state.started) {
    await startGeneration();
  } else {
    resetGenerationState();
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
}

async function collectRandomCoords(polygon: Polygon, n: number): Promise<LatLng[]> {
  const coords: LatLng[] = [];
  const maxAttempts = Math.max(n * 200, 2000);
  let attempts = 0;

  while (coords.length < n && attempts < maxAttempts) {
    attempts++;
    const point = randomPointInPoly(polygon);
    if (
      booleanPointInPolygon([point.lng, point.lat], polygon.feature) &&
      isInChina(point.lng, point.lat) &&
      !isSampleExcluded(point, polygon)
    ) {
      coords.push(point);
    }

    if (attempts % 500 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return coords;
}

async function generate(polygon: Polygon) {
  ensureExclusionZones(polygon);

  try {
    if (settings.strategy === 'grid') {
      const chunkSize = getRequestChunkSize();
      const batchSize = Math.max(chunkSize * 2, 150);

      polygon.isProcessing = true;

      let gridGenerator = gridGenerators.get(polygon._leaflet_id);
      if (!gridGenerator) {
        try {
          gridGenerator = new GridGenerator(polygon, settings.radius);
          gridGenerators.set(polygon._leaflet_id, gridGenerator);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : '区域过大，无法使用网格策略。请缩小区域或改用随机策略。';
          throw new Error(message);
        }
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

          const chinaBatch = batch.filter(
            (point) => isInChina(point.lng, point.lat) && !isSampleExcluded(point, polygon),
          );
          for (const locationGroup of chinaBatch.chunk(chunkSize)) {
            if (!state.started) break;
            if (polygon.found.length >= polygon.nbNeeded) break;
            await Promise.allSettled(locationGroup.map((l) => getLoc(l, polygon)));
          }

          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        // If no new coordinates were generated in this iteration, brief pause before next cycle
        if (!hasMoreCoords && polygon.found.length < polygon.nbNeeded) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Clean up generator when polygon is complete
      if (polygon.found.length >= polygon.nbNeeded) {
        gridGenerators.delete(polygon._leaflet_id);
      }

      return;
    }

    while (polygon.found.length < polygon.nbNeeded) {
      if (!state.started) return;
      polygon.isProcessing = true;

      const n = Math.min(polygon.nbNeeded * 100, settings.speed);
      const randomCoords = await collectRandomCoords(polygon, n);
      if (randomCoords.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const chunkSize = getRequestChunkSize();
      for (const locationGroup of randomCoords.chunk(chunkSize)) {
        if (!state.started) return;
        await Promise.allSettled(locationGroup.map((l) => getLoc(l, polygon)));
      }
    }
  } finally {
    polygon.isProcessing = false;
  }
}

function getPanoramaRequest(loc: LatLng): StreetViewLocationRequest {
  return {
    location: loc,
    radius: settings.radius,
  };
}

async function getLoc(loc: LatLng, polygon: Polygon) {
  if (!polygonStillNeedsLocations(polygon)) return false;
  if (!isInChina(loc.lng, loc.lat)) return false;
  if (isSampleExcluded(loc, polygon)) return false;

  return StreetViewProviders.getPanorama(getPanoramaRequest(loc), async (res, status) => {
    if (!polygonStillNeedsLocations(polygon)) return false;
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
      const panoPoint = {
        lat: res.location.latLng.lat(),
        lng: res.location.latLng.lng(),
      };
      if (isInExclusionZone(panoPoint, polygon, settings.regionRadius)) return false;
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

    const filterCapture = settings.filterCaptureDate;
    const filterPublish = settings.filterPublishDate;

    if (settings.randomInTimeline && res.time?.length) {
      const candidates = res.time.filter((t) => shouldDeepFetchTimelinePano(t));
      if (!candidates.length) return false;
      const randomPano = candidates[Math.floor(Math.random() * candidates.length)];
      getPano(randomPano.pano, polygon);
      return true;
    }

    if (settings.checkAllDates && !settings.selectMonths) {
      if (!res.time?.length) {
        getPano(res.location.pano, polygon);
        return true;
      }
      let fetched = 0;
      for (const timelineLoc of res.time) {
        if (!shouldDeepFetchTimelinePano(timelineLoc)) continue;
        fetched++;
        getPano(timelineLoc.pano, polygon);
      }
      // 勾选采集日时：时间线预筛后无候选则放弃
      if (filterCapture && fetched === 0) return false;
      return fetched > 0;
    }

    {
      const captureDate = getPanoramaDateField(res, 'capture');
      const publishDate = getPanoramaDateField(res, 'publish');
      if (settings.rejectDateless) {
        if (filterCapture && !captureDate) return false;
        if (filterPublish && !publishDate) return false;
        if (!filterCapture && !filterPublish && !captureDate && !publishDate) return false;
      }
      if (!settings.selectMonths) {
        if (filterCapture && captureDate) {
          const { fromDate, toDate } = getCachedCaptureDates();
          const t = Date.parse(captureDate);
          if (!Number.isNaN(t) && (t < fromDate || t > toDate)) return false;
        }
        if (filterPublish && publishDate) {
          const { fromDate, toDate } = getCachedPublishDates();
          const t = Date.parse(publishDate);
          if (!Number.isNaN(t) && (t < fromDate || t > toDate)) return false;
        }
      }
      getPano(res.location.pano, polygon);
    }

    return true;
  });
}

async function isPanoGood(pano: StreetViewPanoramaData) {
  if (!pano.location) return false;

  if (settings.rejectRoadName && (pano.location.road || pano.location.description)) return false;
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

  const filterCapture = settings.filterCaptureDate;
  const filterPublish = settings.filterPublishDate;
  const captureDate = getPanoramaDateField(pano, 'capture');
  const publishDate = getPanoramaDateField(pano, 'publish');

  if (settings.rejectDateless) {
    if (filterCapture && !captureDate) return false;
    if (filterPublish && !publishDate) return false;
    if (!filterCapture && !filterPublish && !captureDate && !publishDate) return false;
  }

  const captureRange = getCachedCaptureDates();
  const publishRange = getCachedPublishDates();
  const fromMonth = settings.fromMonth;
  const toMonth = settings.toMonth;
  const fromYear = settings.fromYear;
  const toYear = settings.toYear;

  const monthInRange = (month: number | string, year: number | string) => {
    const m = Number(month);
    const y = Number(year);
    const fm = Number(fromMonth);
    const tm = Number(toMonth);
    const fy = Number(fromYear);
    const ty = Number(toYear);
    if (y < fy || y > ty) return false;
    if (fm <= tm) return m >= fm && m <= tm;
    return m >= fm || m <= tm;
  };

  const dateInRange = (dateStr: string, range: { fromDate: number; toDate: number }) => {
    if (settings.selectMonths) {
      return monthInRange(dateStr.slice(5, 7), dateStr.slice(0, 4));
    }
    const t = Date.parse(dateStr);
    return !Number.isNaN(t) && t >= range.fromDate && t <= range.toDate;
  };

  if (filterCapture && captureDate && !dateInRange(captureDate, captureRange)) return false;
  if (filterPublish && publishDate && !dateInRange(publishDate, publishRange)) return false;

  if (settings.onlyOneInTimeframe && filterCapture) {
    if (!pano.time?.length) return false;
    for (const loc of pano.time) {
      if (loc.pano == pano.location?.pano) continue;
      const date = findDateInObject(loc);
      const iDate = parseDate(date);
      if (iDate >= captureRange.fromDate && iDate <= captureRange.toDate) return false;
    }
  }

  if (settings.checkAllDates && filterCapture) {
    if (!pano.time?.length) return false;
    let dateWithin = false;
    for (let i = 0; i < pano.time.length; i++) {
      const timeframeDate = findDateInObject(pano.time[i]);
      if (settings.selectMonths) {
        const { month: iDateMonth, year: iDateYear } = extractMonthYear(timeframeDate);
        if (monthInRange(iDateMonth, iDateYear)) {
          dateWithin = true;
          break;
        }
      } else {
        const iDate = parseDate(timeframeDate);
        if (iDate >= captureRange.fromDate && iDate <= captureRange.toDate) {
          dateWithin = true;
          break;
        }
      }
    }
    if (!dateWithin) return false;
  }

  return true;
}

function getPano(id: string, polygon: Polygon) {
  return getPanoDeep(id, polygon, 0);
}

function getPanoDeep(id: string, polygon: Polygon, depth: number) {
  if (!polygonStillNeedsLocations(polygon)) return;
  if (depth > settings.linksDepth) return;
  if (polygon.checkedPanos.has(id)) return;
  if (isRejectedByCachedDates(id)) {
    polygon.checkedPanos.add(id);
    return;
  }
  polygon.checkedPanos.add(id);

  StreetViewProviders.getPanorama({ pano: id }, async (pano, status) => {
    if (!polygonStillNeedsLocations(polygon)) return;
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
    if (!polygonStillNeedsLocations(polygon)) return;

    if (settings.checkAllDates && !settings.selectMonths && pano.time) {
      for (const loc of pano.time) {
        if (!shouldDeepFetchTimelinePano(loc)) continue;
        getPanoDeep(loc.pano, polygon, isPanoGoodAndInCountry ? 1 : depth + 1);
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
          if (!shouldDeepFetchTimelinePano(loc)) continue;
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
  const location = buildPanoramaRecord(pano, settings);
  if (pano.location.altitude != null) {
    location.altitude = pano.location.altitude;
  }

  const index = location.links.indexOf(pano.location.pano);
  if (index != -1) location.links.splice(index, 1);

  const previousPano = pano.time?.[pano.time.length - 2]?.pano;
  if (!previousPano) {
    location.update_type = BAIDU_UPDATE_TYPES.newRoad;
    location.extra.tags.push(location.update_type);
    return addLocation(location, polygon, icons.newLoc);
  }

  location.update_type = BAIDU_UPDATE_TYPES.update;
  location.extra.tags.push(location.update_type);
  return addLocation(location, polygon, icons.gen4);
}

function getIconForUpdateType(updateType: string): L.Icon {
  const normalized = normalizeUpdateType(updateType);
  switch (normalized) {
    case BAIDU_UPDATE_TYPES.newRoad:
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

function removeImportedLocation(location: Panorama) {
  const index = importedLocations.value.findIndex((item) => item.panoId === location.panoId);
  if (index === -1) return;

  importedLocations.value.splice(index, 1);
  allFoundPanoIds.delete(location.panoId);
  removeGlifyPointByPanoId(location.panoId);
}

function addImportedLocation(
  location: Panorama,
  iconType: L.Icon,
  addMarker: boolean = true,
  opacity: number = 1.0,
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

  importedLocations.value.push(location);
  addGlifyPoint(location, markerType, IMPORTED_LOCATIONS_POLYGON_ID);

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
            removeImportedLocation(location);
          },
        },
      ],
    })
      .on('click', () => {
        openPanorama(location);
      })
      .setZIndexOffset(zIndex)
      .addTo(markerLayer);
    marker.imported = true;
  }
}

function addLocation(
  location: Panorama,
  polygon: Polygon,
  iconType: L.Icon,
  addMarker: boolean = true,
  opacity: number = 1.0,
) {
  if (allFoundPanoIds.has(location.panoId)) return;

  const panoPoint = { lat: location.lat, lng: location.lng };
  if (settings.findRegions && isInExclusionZone(panoPoint, polygon, settings.regionRadius)) {
    return;
  }

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

    if (settings.findRegions) {
      getExclusionZones(polygon, settings.regionRadius).add(panoPoint);
    }

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
    }
  }
}

function addImportedFromPano(pano: StreetViewPanoramaData) {
  const location = buildPanoramaRecord(pano, settings);
  if (pano.location.altitude != null) {
    location.altitude = pano.location.altitude;
  }

  const icon = icons.gen4;
  addImportedLocation(
    location,
    icon,
    settings.markersOnImport,
    settings.importedMarkersOpacity ?? 1.0,
  );
}

function getPanoForImport(id: string) {
  return getPanoForImportDeep(id, 0);
}

function getPanoForImportDeep(id: string, depth: number) {
  if (depth > settings.linksDepth) return;
  if (importCheckedPanos.has(id)) return;
  if (isRejectedByCachedDates(id)) {
    importCheckedPanos.add(id);
    return;
  }
  importCheckedPanos.add(id);

  StreetViewProviders.getPanorama({ pano: id }, async (pano, status) => {
    if (status == StreetViewStatus.UNKNOWN_ERROR) {
      importCheckedPanos.delete(id);
      generationConcurrency.recordError();
      const delay = generationConcurrency.getBackoffMs();
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return getPanoForImportDeep(id, depth);
    }
    if (status != StreetViewStatus.OK || !pano?.location) {
      generationConcurrency.recordSuccess();
      return;
    }
    generationConcurrency.recordSuccess();

    const lat = pano.location.latLng.lat();
    const lng = pano.location.latLng.lng();
    const isPanoGoodAndInChina = (await isPanoGood(pano)) && isInChina(lng, lat);

    if (settings.checkAllDates && !settings.selectMonths && pano.time) {
      for (const loc of pano.time) {
        if (!shouldDeepFetchTimelinePano(loc)) continue;
        getPanoForImportDeep(loc.pano, isPanoGoodAndInChina ? 1 : depth + 1);
      }
    }
    if (settings.checkLinks) {
      if (pano.links) {
        for (const loc of pano.links) {
          getPanoForImportDeep(loc.pano, isPanoGoodAndInChina ? 1 : depth + 1);
        }
      }
      if (pano.time) {
        for (const loc of pano.time) {
          if (!shouldDeepFetchTimelinePano(loc)) continue;
          getPanoForImportDeep(loc.pano, isPanoGoodAndInChina ? 1 : depth + 1);
        }
      }
    }
    if (isPanoGoodAndInChina) {
      addImportedFromPano(pano);
    }
  });
}

function isJsonFile(file: File) {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
}

async function importLocations(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;

  const importedPoints: LatLng[] = [];

  for (const file of input.files) {
    if (!isJsonFile(file)) {
      alert('未知文件类型：' + file.type + '。仅支持导入 JSON。');
      continue;
    }

    const result = await readFileAsText(file);
    let JSONResult: { customCoordinates?: Panorama[] };
    try {
      JSONResult = JSON.parse(result);
      if (!JSONResult.customCoordinates) {
        throw new Error('missing customCoordinates');
      }
    } catch (err) {
      alert('JSON 无效。');
      console.error(err);
      continue;
    }

    const importedPanoIds = new Set(
      JSONResult.customCoordinates.map((location) => location.panoId).filter(Boolean) as string[],
    );

    for (const rawLocation of JSONResult.customCoordinates) {
      const location = normalizeImportedPanorama(rawLocation);
      if (!location.panoId || location.lat == null || location.lng == null) continue;

      importedPoints.push({ lat: location.lat, lng: location.lng });

      if (settings.checkImports && location.links) {
        for (const link of location.links) {
          if (!importedPanoIds.has(link)) {
            getPanoForImport(link);
          }
        }
      }

      const icon =
        settings.useUpdateTypeIconsOnImport && location.update_type
          ? getIconForUpdateType(location.update_type)
          : icons.gen4;
      addImportedLocation(
        location,
        icon,
        settings.markersOnImport,
        settings.importedMarkersOpacity ?? 1.0,
      );
    }
  }

  if (importedPoints.length > 0) {
    fitMapToLatLngs(importedPoints);
  }

  input.value = '';
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
