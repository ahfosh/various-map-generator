<template>
  <div
    v-show="isOpen"
    data-scope="collapsible"
    :data-state
  >
    <div v-bind="innerAttrs || $attrs">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  isOpen: boolean

  innerAttrs?: HTMLAttributes
}>()

const dataState = computed(() => (props.isOpen ? 'open' : 'closed'))
</script>