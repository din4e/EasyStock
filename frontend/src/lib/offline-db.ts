// IndexedDB 离线存储管理器
// 离线时缓存物品数据，上线后自动同步变更

const DB_NAME = 'easystock-offline'
const DB_VERSION = 1

// 数据库表名
const STORES = {
  ITEMS: 'items',
  CATEGORIES: 'categories',
  LOCATIONS: 'locations',
  PENDING_OPS: 'pending_ops', // 离线期间待同步的操作队列
} as const

// 离线操作记录
export interface PendingOperation {
  id?: number
  type: 'create' | 'update' | 'delete'
  store: 'items' | 'categories' | 'locations'
  data: Record<string, unknown>
  timestamp: number
  synced: number // 0=未同步, 1=已同步
}

// 打开/创建数据库
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 物品缓存
      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        const itemStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' })
        itemStore.createIndex('barcode', 'barcode', { unique: false })
        itemStore.createIndex('category_id', 'category_id', { unique: false })
        itemStore.createIndex('location_id', 'location_id', { unique: false })
      }

      // 分类缓存
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' })
      }

      // 位置缓存
      if (!db.objectStoreNames.contains(STORES.LOCATIONS)) {
        db.createObjectStore(STORES.LOCATIONS, { keyPath: 'id' })
      }

      // 待同步操作队列
      if (!db.objectStoreNames.contains(STORES.PENDING_OPS)) {
        const opStore = db.createObjectStore(STORES.PENDING_OPS, {
          keyPath: 'id',
          autoIncrement: true,
        })
        opStore.createIndex('synced', 'synced', { unique: false })
        opStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

// 通用：写入缓存（批量）
async function putAll(storeName: string, items: Record<string, unknown>[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  // 先清空旧数据
  store.clear()

  for (const item of items) {
    store.put(item)
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 通用：写入缓存（单条）
async function put(storeName: string, item: Record<string, unknown>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).put(item)

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 通用：读取全部缓存
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  const tx = db.transaction(storeName, 'readonly')
  const request = tx.objectStore(storeName).getAll()

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

// 通用：删除单条缓存
async function remove(storeName: string, id: number): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).delete(id)

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 添加待同步操作
async function addPendingOp(op: Omit<PendingOperation, 'id'>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_OPS, 'readwrite')
  tx.objectStore(STORES.PENDING_OPS).add(op)

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 获取所有未同步操作
async function getPendingOps(): Promise<PendingOperation[]> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_OPS, 'readonly')
  const index = tx.objectStore(STORES.PENDING_OPS).index('synced')
  const request = index.getAll(0)

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as PendingOperation[])
    request.onerror = () => reject(request.error)
  })
}

// 标记操作已同步
async function markOpSynced(id: number): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_OPS, 'readwrite')
  const store = tx.objectStore(STORES.PENDING_OPS)
  const request = store.get(id)

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const op = request.result
      if (op) {
        op.synced = 1
        store.put(op)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 清除已同步操作
async function clearSyncedOps(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_OPS, 'readwrite')
  const store = tx.objectStore(STORES.PENDING_OPS)
  const index = store.index('synced')
  const request = index.openCursor(IDBKeyRange.only(1))

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 导出离线存储 API
export const offlineDB = {
  // 物品缓存
  cacheItems: (items: Record<string, unknown>[]) => putAll(STORES.ITEMS, items),
  cacheItem: (item: Record<string, unknown>) => put(STORES.ITEMS, item),
  getCachedItems: <T>() => getAll<T>(STORES.ITEMS),
  removeCachedItem: (id: number) => remove(STORES.ITEMS, id),

  // 分类缓存
  cacheCategories: (items: Record<string, unknown>[]) => putAll(STORES.CATEGORIES, items),
  getCachedCategories: <T>() => getAll<T>(STORES.CATEGORIES),

  // 位置缓存
  cacheLocations: (items: Record<string, unknown>[]) => putAll(STORES.LOCATIONS, items),
  getCachedLocations: <T>() => getAll<T>(STORES.LOCATIONS),

  // 待同步操作
  addPendingOp,
  getPendingOps,
  markOpSynced,
  clearSyncedOps,
}
