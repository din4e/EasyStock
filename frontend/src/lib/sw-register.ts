// PWA Service Worker 注册工具
// 提供离线缓存、后台同步等能力

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)

  return navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('[PWA] Service Worker 注册成功，scope:', registration.scope)

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[PWA] 新版本已激活，可刷新页面获取最新版本')
          }
        })
      })

      return registration
    })
    .catch((error) => {
      console.error('[PWA] Service Worker 注册失败:', error)
      return null
    })
}

export function unregisterServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!('serviceWorker' in navigator)) return Promise.resolve()

  return navigator.serviceWorker.getRegistrations().then((registrations) => {
    return Promise.all(registrations.map((reg) => reg.unregister()))
  }).then(() => {
    console.log('[PWA] Service Worker 已注销')
  })
}
