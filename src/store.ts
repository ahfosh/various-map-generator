import { ref, reactive } from 'vue'

const selected = ref<Polygon[]>([])

const select = ref('Select a China region or draw a polygon')

const state = reactive({
  started: false,
})

export function useStore() {
  return { selected, select, state }
}
