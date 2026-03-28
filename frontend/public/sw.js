/// <reference lib="webworker" />

// EasyStock Service Worker
// 提供离线缓存和后台同步能力

const CACHE_NAME = 'easystock-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
]

// 需要网络优先的 API 路径前缀
const API_PREFIX = '/api/v1'

// 安装事件：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存静态资源')
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // 跳过等待，立即激活新版本
  self.skipWaiting()
})

// 激活事件：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name)
            return caches.delete(name)
          })
      )
    })
  )
  // 立即控制所有页面
  self.clients.claim()
})

// 请求拦截：根据请求类型选择缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 只处理同源请求
  if (url.origin !== self.location.origin) return

  // API 请求：网络优先，失败后回退缓存
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(networkFirstWithCache(request))
    return
  }

  // 静态资源：缓存优先，回退网络
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request))
    return
  }

  // 页面请求：网络优先
  event.respondWith(networkFirstWithCache(request))
})

// 网络优先策略：优先请求网络，失败使用缓存
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request)
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    // 离线时 API 请求返回离线标识
    if (request.url.includes(API_PREFIX)) {
      return new Response(
        JSON.stringify({ error: '离线模式，无法连接服务器', offline: true }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    return new Response('离线模式', { status: 503 })
  }
}

// 缓存优先策略：优先使用缓存，回退网络
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    return new Response('资源不可用', { status: 404 })
  }
}

// 判断是否为静态资源
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf|eot)$/.test(pathname)
    || pathname.startsWith('/_next/static/')
}

// 后台同步事件：处理离线期间产生的数据操作
self.addEventListener('sync', (event) => {
  if (event.tag === 'easystock-sync') {
    console.log('[SW] 触发后台同步')
    event.waitUntil(syncOfflineData())
  }
})

// 离线数据同步逻辑
async function syncOfflineData() {
  // 通知所有客户端开始同步
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUIRED' })
  })
}

// 推送通知（预留）
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.tag || 'default',
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'EasyStock', options)
  )
})
