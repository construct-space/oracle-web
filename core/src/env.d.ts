/// <reference types="vite/client" />

// Ambient shim so vue-tsc accepts `import X from 'foo.vue'` — applies to
// .vue imports anywhere in the project graph (core/, packages/*/, spaces/*/).
// packages/ui-web has its own copy for its own typecheck; core needs this
// one for Docker builds where only core/tsconfig.json is in play.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
