<template>
  <Button size="sm" squared :disabled title="导出为 CSV" @click="handleExport">
    <FileCSV class="w-5 h-5" />
  </Button>
</template>

<script setup lang="ts">
import Button from './Elements/Button.vue'
import FileCSV from '@/assets/icons/file-csv.svg'

const props = defineProps<{
  data: Polygon[]
  disabled?: boolean
}>()

function handleExport() {
  let csv = ''
  let nbLocs = 0
  props.data.forEach((polygon) => {
    polygon.found.forEach((coords) => {
      csv += `${coords.lat},${coords.lng},\n`
      nbLocs++
    })
  })
  const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
  const fileName = `生成的地图（${nbLocs} 个地点）.csv`
  const linkElement = document.createElement('a')
  linkElement.href = dataUri
  linkElement.download = fileName
  linkElement.click()
}
</script>
