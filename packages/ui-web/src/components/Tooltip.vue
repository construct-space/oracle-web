<script setup lang="ts">
// Tooltip — instant, teleported to <body>, positioned synchronously
// from the trigger's rect (no dependence on tooltip self-measurement).
// CSS transforms handle centering on each side, so the first hover
// shows the tooltip already in the right place — no flash, no race
// with v-if + Teleport ref binding.
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    text?: string
    content?: { side?: 'top' | 'bottom' | 'left' | 'right'; align?: 'start' | 'center' | 'end'; sideOffset?: number }
    popper?: { placement?: string }
  }>(),
  { text: '' },
)

const triggerRef = ref<HTMLElement | null>(null)
const show = ref(false)
const top = ref('0px')
const left = ref('0px')

const side = computed(() => props.content?.side || 'bottom')
const offset = computed(() => props.content?.sideOffset ?? 6)

// CSS transform centers the tooltip on the chosen side without
// needing to know the tooltip's own dimensions.
const transform = computed(() => {
  switch (side.value) {
    case 'top': return 'translate(-50%, -100%)'
    case 'bottom': return 'translate(-50%, 0)'
    case 'left': return 'translate(-100%, -50%)'
    case 'right': return 'translate(0, -50%)'
  }
  return 'translate(-50%, 0)'
})

function position() {
  const el = triggerRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const o = offset.value
  let t = 0, l = 0
  switch (side.value) {
    case 'top':    t = r.top - o;             l = r.left + r.width / 2; break
    case 'bottom': t = r.bottom + o;          l = r.left + r.width / 2; break
    case 'left':   t = r.top + r.height / 2;  l = r.left - o;           break
    case 'right':  t = r.top + r.height / 2;  l = r.right + o;          break
  }
  top.value = `${t}px`
  left.value = `${l}px`
}

function onEnter() {
  position()
  show.value = true
}

function onLeave() {
  show.value = false
}
</script>

<template>
  <span
    ref="triggerRef"
    class="tooltip-trigger"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onLeave"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="show && text"
      class="tooltip-bubble"
      :style="{ top, left, transform }"
      role="tooltip"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<style scoped>
.tooltip-trigger {
  display: inline-flex;
}
.tooltip-bubble {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background-color: #1f2937;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  padding: 6px 10px;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  white-space: nowrap;
  max-width: 280px;
}
</style>
