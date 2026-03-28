"use client"

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/sw-register'

/**
 * PWA 注册组件
 * 挂载后自动注册 service worker，提供离线缓存能力
 */
export function PWARegister() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}
