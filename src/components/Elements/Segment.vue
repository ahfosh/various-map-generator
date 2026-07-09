<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T
  options: { value: T; label: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <div
    class="inline-flex rounded-md border border-neutral-500/80 overflow-hidden text-xs bg-black/20"
    role="group"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="px-2.5 py-1 transition-colors duration-150 cursor-pointer border-0 border-r border-neutral-500/60 last:border-r-0"
      :class="
        modelValue === opt.value
          ? 'bg-neutral-200 text-black font-medium'
          : 'bg-transparent text-inherit hover:bg-white/10'
      "
      :aria-pressed="modelValue === opt.value"
      @mousedown.prevent
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
