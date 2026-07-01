<script setup lang="ts">
import { computed } from 'vue'
import BaiduIcon from '@/assets/icons/baidu.svg'

const props = defineProps<{
  size?: string
  animate?: boolean
}>()

const { size = '1' } = props

const iconComponent = computed(() => BaiduIcon)
</script>

<template>
  <component :is="iconComponent" :class="{ 'spinner-animate': animate }" :style="{ width: size + 'rem' }" />
</template>

<style scoped>
.spinner-animate {
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