<script setup lang="ts">
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from 'd3-zoom'
import { computed, onMounted, ref } from 'vue'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { NAME_TO_ALPHA2, numericToAlpha2 } from '@/lib/iso3166'

interface DataPoint {
  country_code: string
  value: number
}

const props = defineProps<{
  data: DataPoint[]
  selected?: string
  width?: number
  height?: number
}>()

const emit = defineEmits<{
  select: [country: string]
}>()

const w = computed(() => props.width ?? 960)
const h = computed(() => props.height ?? 480)

// featureKey resolves a country path to its alpha-2 code via numeric id
// when present, falling back to a name-keyed bridge for ID-less features
// like Kosovo. Returning '' (rather than null) keeps the call sites
// terse — empty key means "no bound country, render as inactive".
type FeatureLike = { id?: string | number | null; properties?: Record<string, unknown> | null }

function featureKey(f: FeatureLike): string {
  if (f.id != null && f.id !== '') {
    const num = String(f.id).padStart(3, '0')
    const cc = numericToAlpha2(num)
    if (cc) return cc
  }
  const name = (f.properties as Record<string, string> | null)?.name
  if (name && NAME_TO_ALPHA2[name]) return NAME_TO_ALPHA2[name]
  return ''
}

// alpha-2 → DataPoint, after normalizing keys to upper-case so callers can
// pass mixed case.
const dataByCC = computed(() => {
  const m: Record<string, DataPoint> = {}
  for (const d of props.data) {
    if (!d.country_code) continue
    m[d.country_code.toUpperCase()] = d
  }
  return m
})

const maxValue = computed(() => {
  let max = 0
  for (const v of Object.values(dataByCC.value)) {
    if (v.value > max) max = v.value
  }
  return max
})

function colorForFeature(f: FeatureLike): string {
  const cc = featureKey(f)
  const point = cc ? dataByCC.value[cc] : undefined
  if (!point || point.value <= 0 || maxValue.value <= 0) return 'rgba(255,255,255,0.04)'
  const ratio = Math.log1p(point.value) / Math.log1p(maxValue.value)
  // Blue ramp; alpha 0.20 → 0.95 so even the smallest active country
  // reads against the 0.04 base.
  const alpha = 0.2 + ratio * 0.75
  return `rgba(59, 130, 246, ${alpha.toFixed(2)})`
}

function isSelectedFeature(f: FeatureLike): boolean {
  if (!props.selected) return false
  return featureKey(f) === props.selected.toUpperCase()
}

const features = ref<FeatureCollection['features']>([])
const loadError = ref('')

// Natural Earth I gives a balanced world view — no polar over-stretch
// of equirectangular, less area distortion than Mercator.
const projection = computed(() =>
  geoNaturalEarth1().fitSize([w.value, h.value], { type: 'Sphere' } as never),
)
const pathGen = computed(() => geoPath(projection.value))

const tooltip = ref<{ x: number; y: number; cc: string; name: string; value: number } | null>(null)

function onEnter(e: MouseEvent, f: FeatureLike) {
  const cc = featureKey(f)
  const point = cc ? dataByCC.value[cc] : undefined
  const name = (f.properties as Record<string, string> | null)?.name ?? ''
  tooltip.value = {
    x: e.offsetX,
    y: e.offsetY,
    cc,
    name,
    value: point?.value ?? 0,
  }
}

function onLeave() {
  tooltip.value = null
}

function onClick(e: MouseEvent, f: FeatureLike) {
  // d3-zoom calls preventDefault on its own gestures, so a real click
  // (no drag) bubbles through unaltered. defaultPrevented filters out
  // any drag-then-release that the browser still synthesizes as a click.
  if (e.defaultPrevented) return
  const cc = featureKey(f)
  if (cc) emit('select', cc)
}

// ── Zoom + pan ────────────────────────────────────────────────────────────
// d3-zoom owns the math; we mirror its current transform into the SVG
// so the inner <g> follows. Stroke widths get inverse-scaled so borders
// don't look chunky at high zoom.
const svgRef = ref<SVGSVGElement | null>(null)
const transform = ref<ZoomTransform>(zoomIdentity)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null

const transformAttr = computed(() => {
  const t = transform.value
  return `translate(${t.x},${t.y}) scale(${t.k})`
})
const strokeUnit = computed(() => Math.max(0.05, 0.4 / transform.value.k))
const selectedStrokeUnit = computed(() => Math.max(0.2, 1.5 / transform.value.k))

function setupZoom() {
  if (!svgRef.value) return
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 12])
    .on('zoom', (event) => { transform.value = event.transform })
  select(svgRef.value).call(zoomBehavior)
}

function zoomIn() {
  if (!svgRef.value || !zoomBehavior) return
  select(svgRef.value).call(zoomBehavior.scaleBy, 1.5)
}
function zoomOut() {
  if (!svgRef.value || !zoomBehavior) return
  select(svgRef.value).call(zoomBehavior.scaleBy, 1 / 1.5)
}
function resetZoom() {
  if (!svgRef.value || !zoomBehavior) return
  select(svgRef.value).call(zoomBehavior.transform, zoomIdentity)
}

onMounted(async () => {
  setupZoom()
  try {
    const mod = await import('world-atlas/countries-110m.json')
    const topo = (mod.default ?? mod) as unknown as Topology
    const collection = feature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection<Geometry, { name: string }>
    features.value = collection.features
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="relative w-full">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${w} ${h}`"
      class="w-full h-auto bg-[var(--app-card-bg)] rounded-xl border border-[var(--app-border)] cursor-grab active:cursor-grabbing"
      role="img"
      aria-label="World map showing active users by country"
    >
      <g :transform="transformAttr">
        <!-- Sphere outline so the projection edges read against the page bg -->
        <path
          :d="pathGen({ type: 'Sphere' } as never) ?? ''"
          fill="rgba(255,255,255,0.02)"
          stroke="var(--app-border)"
          :stroke-width="strokeUnit"
        />
        <path
          v-for="(f, i) in features"
          :key="`${f.id ?? (f.properties as Record<string, string> | null)?.name ?? i}`"
          :d="pathGen(f as never) ?? ''"
          :fill="colorForFeature(f)"
          :stroke="isSelectedFeature(f) ? '#fbbf24' : 'var(--app-border)'"
          :stroke-width="isSelectedFeature(f) ? selectedStrokeUnit : strokeUnit"
          class="cursor-pointer"
          @mouseenter="onEnter($event, f)"
          @mouseleave="onLeave"
          @click="onClick($event, f)"
        />
      </g>
    </svg>

    <!-- Zoom controls — pinned top-right, always above the map. -->
    <div class="absolute top-3 right-3 flex flex-col gap-1 z-20">
      <button
        type="button"
        class="size-8 rounded-md bg-black/40 hover:bg-black/60 text-white text-base flex items-center justify-center backdrop-blur"
        title="Zoom in"
        @click="zoomIn"
      >+</button>
      <button
        type="button"
        class="size-8 rounded-md bg-black/40 hover:bg-black/60 text-white text-base flex items-center justify-center backdrop-blur"
        title="Zoom out"
        @click="zoomOut"
      >−</button>
      <button
        type="button"
        class="size-8 rounded-md bg-black/40 hover:bg-black/60 text-white text-xs flex items-center justify-center backdrop-blur"
        title="Reset"
        @click="resetZoom"
      >⟲</button>
    </div>

    <div
      v-if="tooltip"
      class="pointer-events-none absolute z-10 px-2 py-1 rounded-md bg-black/80 text-white text-xs shadow"
      :style="{ left: `${tooltip.x + 12}px`, top: `${tooltip.y + 12}px` }"
    >
      <div class="font-medium">{{ tooltip.name }}<span v-if="tooltip.cc"> · {{ tooltip.cc }}</span></div>
      <div class="text-[var(--app-muted)]">{{ tooltip.value }} user{{ tooltip.value === 1 ? '' : 's' }}</div>
    </div>

    <div v-if="loadError" class="text-xs text-rose-500 mt-2">map load failed: {{ loadError }}</div>
  </div>
</template>
