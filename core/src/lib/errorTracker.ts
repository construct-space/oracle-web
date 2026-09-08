/**
 * Capture runtime errors in oracle-web and POST a low-cardinality class
 * string to /api/telemetry/error. Hooks Vue's render-error handler plus
 * window.onerror and window.onunhandledrejection.
 *
 * Only the class is shipped — no message, no stack, no URL. The class is
 * the Error subtype name normalized to snake_case (TypeError → type_error).
 * Vue render errors get a "vue.<class>" prefix so they're separable from
 * non-render errors at query time.
 */
import type { App } from 'vue'

let installed = false

function classify(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name || 'Error'
    return name
      .replace(/Error$/, '_error')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/^_+|_+$/g, '')
      || 'runtime'
  }
  return 'runtime'
}

// Tiny in-process throttle: error storms (e.g. an infinite loop firing the
// same TypeError every paint) shouldn't spam the network. Cap at one POST
// per class per minute. Class cardinality is bounded so the Map stays small.
const lastSent = new Map<string, number>()
const THROTTLE_MS = 60_000

async function emit(errorClass: string): Promise<void> {
  const now = Date.now()
  const prev = lastSent.get(errorClass) || 0
  if (now - prev < THROTTLE_MS) return
  lastSent.set(errorClass, now)
  try {
    await fetch('/api/telemetry/error', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error_class: errorClass }),
    })
  } catch {
    // Telemetry must never break the app.
  }
}

/**
 * Install once at app boot. Pass the Vue app to capture render errors
 * with a vue.<class> prefix; without it we still catch raw window-level
 * errors but lose the Vue-vs-runtime split.
 */
export function installErrorTracker(app?: App): void {
  if (installed) return
  installed = true

  if (app) {
    const prev = app.config.errorHandler
    app.config.errorHandler = (err, instance, info) => {
      void emit(`vue.${classify(err)}`)
      if (typeof prev === 'function') prev(err, instance, info)
      else console.error('[errorTracker] vue:', err, info)
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      void emit(classify(e.error ?? e))
    })
    window.addEventListener('unhandledrejection', (e) => {
      void emit(classify(e.reason))
    })
  }
}
