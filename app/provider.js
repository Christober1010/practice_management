'use client'

import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import { Toaster, toast, useToasterStore } from 'react-hot-toast'

/**
 * react-hot-toast pauses all timers on toaster mouseenter. Nested full-viewport
 * Toasters (or a toast under the cursor) can leave pausedAt set forever so
 * toasts never auto-dismiss. Unstick pause and hard-remove overdue toasts.
 */
function ToastUnstick() {
  const { toasts, pausedAt } = useToasterStore()

  useEffect(() => {
    if (!pausedAt) return
    const t = setTimeout(() => {
      document.querySelectorAll('[data-rht-toaster]').forEach((el) => {
        el.dispatchEvent(new Event('mouseleave', { bubbles: true }))
      })
    }, 4500)
    return () => clearTimeout(t)
  }, [pausedAt])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      for (const t of toasts) {
        if (!t.visible || t.duration == null || t.duration === Infinity) continue
        const lived = now - t.createdAt - (t.pauseDuration || 0)
        if (lived > t.duration + 1500) {
          toast.remove(t.id)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [toasts])

  return null
}

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      {children}
      <ToastUnstick />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          success: { duration: 4000 },
          error: { duration: 5000 },
        }}
      />
    </Provider>
  )
}
