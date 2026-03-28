"use client"

import { useEffect, useCallback, useState } from 'react'
import { offlineDB, PendingOperation } from '@/lib/offline-db'
import { api } from '@/lib/api'

// 同步状态
interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: Date | null
}

/**
 * 离线数据同步 Hook
 * 监听网络状态变化，上线时自动同步离线操作
 */
export function useOfflineSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
  })

  // 刷新待同步数量
  const refreshPendingCount = useCallback(async () => {
    try {
      const ops = await offlineDB.getPendingOps()
      setSyncState((prev) => ({ ...prev, pendingCount: ops.length }))
    } catch {
      // IndexedDB 不可用（如隐私模式）
    }
  }, [])

  // 执行离线操作同步
  const syncPendingOperations = useCallback(async () => {
    if (syncState.isSyncing || !navigator.onLine) return

    setSyncState((prev) => ({ ...prev, isSyncing: true }))

    try {
      const ops = await offlineDB.getPendingOps()
      if (ops.length === 0) {
        setSyncState((prev) => ({ ...prev, isSyncing: false }))
        return
      }

      // 按时间顺序处理
      const sorted = ops.sort((a, b) => a.timestamp - b.timestamp)

      for (const op of sorted) {
        try {
          await executeOperation(op)
          await offlineDB.markOpSynced(op.id!)
        } catch (error) {
          console.error('[OfflineSync] 操作同步失败:', op, error)
          // 单个失败不阻塞后续操作
        }
      }

      await offlineDB.clearSyncedOps()

      // 同步完成后刷新服务端数据到本地缓存
      await cacheServerData()

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }))

      await refreshPendingCount()
    } catch (error) {
      console.error('[OfflineSync] 同步过程异常:', error)
      setSyncState((prev) => ({ ...prev, isSyncing: false }))
    }
  }, [syncState.isSyncing, refreshPendingCount])

  // 执行单个离线操作
  const executeOperation = async (op: PendingOperation) => {
    switch (op.store) {
      case 'items':
        if (op.type === 'create') {
          await api.createItem(op.data as any)
        } else if (op.type === 'update') {
          await api.updateItem(op.data.id as number, op.data as any)
        } else if (op.type === 'delete') {
          await api.deleteItem(op.data.id as number)
        }
        break
      case 'categories':
        if (op.type === 'create') {
          await api.createCategory(op.data as any)
        } else if (op.type === 'update') {
          await api.updateCategory(op.data.id as number, op.data as any)
        } else if (op.type === 'delete') {
          await api.deleteCategory(op.data.id as number)
        }
        break
      case 'locations':
        if (op.type === 'create') {
          await api.createLocation(op.data as any)
        } else if (op.type === 'update') {
          await api.updateLocation(op.data.id as number, op.data as any)
        } else if (op.type === 'delete') {
          await api.deleteLocation(op.data.id as number)
        }
        break
    }
  }

  // 从服务端拉取数据并缓存到 IndexedDB
  const cacheServerData = async () => {
    try {
      const [items, categories, locations] = await Promise.all([
        api.getItems().catch(() => []),
        api.getCategories().catch(() => []),
        api.getLocations().catch(() => []),
      ])
      await Promise.all([
        offlineDB.cacheItems(items),
        offlineDB.cacheCategories(categories),
        offlineDB.cacheLocations(locations),
      ])
    } catch {
      // 缓存失败不影响主流程
    }
  }

  // 记录离线操作
  const recordOfflineOp = useCallback(
    async (type: PendingOperation['type'], store: PendingOperation['store'], data: Record<string, unknown>) => {
      await offlineDB.addPendingOp({
        type,
        store,
        data,
        timestamp: Date.now(),
        synced: 0,
      })
      await refreshPendingCount()
    },
    [refreshPendingCount]
  )

  // 监听网络状态和 SW 同步消息
  useEffect(() => {
    const handleOnline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: true }))
      // 上线后自动同步
      syncPendingOperations()
    }

    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: false }))
    }

    // 监听 SW 的同步消息
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_REQUIRED') {
        syncPendingOperations()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    // 初始化：加载待同步数量
    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [syncPendingOperations, refreshPendingCount])

  return {
    ...syncState,
    recordOfflineOp,
    syncPendingOperations,
    cacheServerData,
    refreshPendingCount,
  }
}
