import { useTheme } from '@construct-space/ui-web'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { installErrorTracker } from './lib/errorTracker'
import { router } from './router'
import './style.css'

useTheme().init()

const app = createApp(App)
app.use(createPinia())
app.use(router)
installErrorTracker(app)
app.mount('#app')
