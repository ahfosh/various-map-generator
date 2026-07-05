<template>
  <Button size="sm" squared :disabled title="导出为 JSON" @click="handleExport">
    <FileExportIcon class="w-5 h-5" />
  </Button>
</template>

<script setup lang="ts">
import Button from './Elements/Button.vue'
import FileExportIcon from '@/assets/icons/file-export.svg'

const props = defineProps<{
  data: Polygon[]
  imported?: Panorama[]
  disabled?: boolean
  mode?: string
  tag?: boolean
}>()

function formatLocation(item: Panorama): Panorama {
  return {
    ...item,
    panoId:
      props.mode === 'disable' ? null : props.mode === 'prefix' ? `BAIDU:${item.panoId}` : item.panoId,
    links: item.links?.slice(0, 4),
    extra: {
      tags: props.tag ? item.extra?.tags! : [],
    },
  }
}

function handleExport() {
  let data: Panorama[] = []
  props.data.forEach((polygon) => {
    data = data.concat(polygon.found.map(formatLocation))
  })
  if (props.imported?.length) {
    data = data.concat(props.imported.map(formatLocation))
  }
  const dataUri =
    'data:application/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify({ customCoordinates: data }))

  const name =
    props.data.length === 1 && props.data[0].feature.properties.name
      ? props.data[0].feature.properties.name
      : '生成的地图'

  const fileName = `${name}（${data.length} 个地点）.json`

  const linkElement = document.createElement('a')
  linkElement.href = dataUri
  linkElement.download = fileName
  linkElement.click()
}
</script>
