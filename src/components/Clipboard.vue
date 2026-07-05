<template>
  <Button v-if="isSupported" size="sm" squared :disabled title="复制到剪贴板" @click="handleCopy">
    <ClipboardCheckedIcon v-if="copied" class="w-5 h-5" />
    <ClipboardIcon v-else class="w-5 h-5" />
  </Button>
</template>

<script setup lang="ts">
import Button from './Elements/Button.vue'
import ClipboardIcon from '@/assets/icons/clipboard.svg'
import ClipboardCheckedIcon from '@/assets/icons/clipboard-checked.svg'
import { useClipboard } from '@vueuse/core'
const { copy, copied, isSupported } = useClipboard()

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

function handleCopy() {
  let data: Panorama[] = []

  props.data.forEach((polygon) => {
    data = data.concat(polygon.found.map(formatLocation))
  })
  if (props.imported?.length) {
    data = data.concat(props.imported.map(formatLocation))
  }

  copy(JSON.stringify({ customCoordinates: data }))
}
</script>
