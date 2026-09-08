import { defineStore } from 'pinia'

interface AuthState {
  checked: boolean
  authenticated: boolean
  user: null | {
    email?: string
    name?: string
    role?: string
  }
}

export const useAuthStore = defineStore('oracle-auth', {
  state: (): AuthState => ({
    checked: false,
    authenticated: false,
    user: null,
  }),
  actions: {
    async login(email: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Login failed')
      }
      await this.check()
    },
    async check() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          this.authenticated = false
          this.user = null
          this.checked = true
          return
        }
        const data = (await res.json().catch(() => ({}))) as Record<string, any>
        const user = (data.user && typeof data.user === 'object' ? data.user : data) as Record<string, any>
        this.authenticated = true
        this.user = {
          email: typeof user.email === 'string' ? user.email : undefined,
          name: typeof user.name === 'string' ? user.name : 'Oracle Admin',
          role: typeof user.role === 'string' ? user.role : undefined,
        }
      } catch {
        this.authenticated = false
        this.user = null
      } finally {
        this.checked = true
      }
    },
    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      } finally {
        this.authenticated = false
        this.user = null
      }
    },
  },
})
