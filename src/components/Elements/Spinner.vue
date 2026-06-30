<script setup lang="ts">
import { computed } from 'vue'
import GeoIcon from '@/assets/icons/geoicon.svg'
import BaiduIcon from '@/assets/icons/baidu.svg'

const props = defineProps<{
  size?: string
  icon?: string
}>()

const { size = '1' } = props

const icons: Record<string, typeof BaiduIcon> = {
  geo: GeoIcon,
  baidu: BaiduIcon,
}

const iconComponent = computed(() => {
  return icons[props.icon ?? 'baidu'] ?? BaiduIcon
})
</script>

<template>
  <component :is="iconComponent" :style="{ width: size + 'rem' }" />
</template>

<style scoped>
svg {
  animation: spin 8s infinite ease-in-out;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-360deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>