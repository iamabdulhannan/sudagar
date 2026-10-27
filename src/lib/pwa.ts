/** register the service worker (production builds only) so the app opens without internet */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline install is optional */ })
  })
  // keep the data: ask the browser not to clear IndexedDB under storage pressure
  navigator.storage?.persist?.().catch(() => {})
}
