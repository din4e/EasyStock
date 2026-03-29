"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Package, Plus, Search, ScanLine, Edit, Trash2, Sparkles, Camera, Receipt, Barcode } from 'lucide-react'
import { api } from '@/lib/api'
import { offlineDB } from '@/lib/offline-db'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { compressImage, validateImageFile } from '@/lib/image-utils'
import { recognizeFromImage as browserOCR, isBrowserOCRAvailable } from '@/lib/browser-ocr'
import { FileUpload, RecognitionLoading } from '@/components/ui/file-upload'
import { AIResultModal, RecognizedItem } from '@/components/ui/ai-result-modal'
import dynamic from 'next/dynamic'

// 动态导入 BarcodeScanner 组件，禁用 SSR
const BarcodeScanner = dynamic(
  () => import('@/components/ui/barcode-scanner').then(mod => ({ default: mod.BarcodeScanner })),
  { ssr: false }
)

interface Item {
  id: number
  name: string
  barcode: string
  quantity: number
  unit: string
  price: number
  cost: number
  expired_at: string | null
  description: string
  note: string
  category: { id: number; name: string } | null
  location: { id: number; name: string } | null
}

interface Category {
  id: number
  name: string
}

interface Location {
  id: number
  name: string
}

type RecognitionType = 'product' | 'receipt' | 'barcode'

export default function ItemsPage() {
  const searchParams = useSearchParams()
  const { recordOfflineOp } = useOfflineSync()
  const tAi = useTranslations('ai')
  const tCommon = useTranslations('common')
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')

  // AI Recognition states
  const [showAIUpload, setShowAIUpload] = useState(false)
  const [recognitionType, setRecognitionType] = useState<RecognitionType>('product')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [aiResult, setAIResult] = useState<{
    items: RecognizedItem[]
    provider: string
    model: string
  } | null>(null)
  const [aiStatus, setAIStatus] = useState<{ configured: boolean; provider: string; browserOCR?: boolean } | null>(null)

  // Barcode scanner states
  const [showScanner, setShowScanner] = useState(false)
  const [scannerMode, setScannerMode] = useState<'lookup' | 'add'>('add')

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: '',
    unit: '',
    price: '',
    cost: '',
    expired_at: '',
    description: '',
    note: '',
    category_id: '',
    location_id: '',
  })

  useEffect(() => {
    loadData()
    checkAIStatus()
    const action = searchParams.get('action')
    if (action === 'add') {
      setShowModal(true)
    } else if (action === 'scan') {
      openScanner('add')
    }
  }, [searchParams])

  const loadData = async () => {
    // 离线模式：从 IndexedDB 加载缓存数据
    if (!navigator.onLine) {
      try {
        const [cachedItems, cachedCategories, cachedLocations] = await Promise.all([
          offlineDB.getCachedItems<Item>(),
          offlineDB.getCachedCategories<Category>(),
          offlineDB.getCachedLocations<Location>(),
        ])
        setItems(cachedItems)
        setCategories(cachedCategories)
        setLocations(cachedLocations)
      } catch (error) {
        console.error('Failed to load offline data:', error)
      } finally {
        setLoading(false)
      }
      return
    }

    // 在线模式：从 API 加载并缓存到 IndexedDB
    try {
      const [itemsData, categoriesData, locationsData] = await Promise.all([
        api.getItems(),
        api.getCategories(),
        api.getLocations(),
      ])
      // 缓存数据
      await Promise.all([
        offlineDB.cacheItems(itemsData as unknown as Record<string, unknown>[]),
        offlineDB.cacheCategories(categoriesData as unknown as Record<string, unknown>[]),
        offlineDB.cacheLocations(locationsData as unknown as Record<string, unknown>[]),
      ])
      setItems(itemsData)
      setCategories(categoriesData)
      setLocations(locationsData)
    } catch (error) {
      console.error('Failed to load data:', error)
      // API 失败时尝试加载缓存
      try {
        const [cachedItems, cachedCategories, cachedLocations] = await Promise.all([
          offlineDB.getCachedItems<Item>(),
          offlineDB.getCachedCategories<Category>(),
          offlineDB.getCachedLocations<Location>(),
        ])
        setItems(cachedItems)
        setCategories(cachedCategories)
        setLocations(cachedLocations)
      } catch {
        // 缓存也失败
      }
    } finally {
      setLoading(false)
    }
  }

  const checkAIStatus = async () => {
    try {
      const [status, browserOCR] = await Promise.all([
        api.getAIStatus(),
        api.isBrowserOCRAvailable(),
      ])
      setAIStatus({ ...status, browserOCR })
    } catch (error) {
      console.error('Failed to check AI status:', error)
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const data = await api.getItems({
        search: search || undefined,
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        location_id: locationFilter ? Number(locationFilter) : undefined,
      })
      setItems(data)
    } catch (error) {
      console.error('Failed to search:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      quantity: Number(formData.quantity),
      price: Number(formData.price),
      cost: Number(formData.cost),
      expired_at: formData.expired_at || undefined,
      category_id: formData.category_id ? Number(formData.category_id) : undefined,
      location_id: formData.location_id ? Number(formData.location_id) : undefined,
    }

    // 离线模式：记录操作到 IndexedDB，稍后同步
    if (!navigator.onLine) {
      if (editingItem) {
        // 离线更新
        await recordOfflineOp('update', 'items', { ...data, id: editingItem.id })
        // 更新本地缓存显示
        const updatedItems = items.map(item =>
          item.id === editingItem.id ? { ...item, ...data, expired_at: data.expired_at ?? null } : item
        )
        setItems(updatedItems)
      } else {
        // 离线创建 - 记录到同步队列，本地显示不变，等同步完成后刷新
        await recordOfflineOp('create', 'items', data)
      }

      setShowModal(false)
      resetForm()
      return
    }

    // 在线模式：直接调用 API
    try {
      if (editingItem) {
        await api.updateItem(editingItem.id, data)
      } else {
        await api.createItem(data)
      }
      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Failed to save item:', error)
      // API 失败时降级到离线模式
      const tempId = Date.now()
      if (editingItem) {
        await recordOfflineOp('update', 'items', { ...data, id: editingItem.id })
      } else {
        await recordOfflineOp('create', 'items', data)
      }
      setShowModal(false)
      resetForm()
    }
  }

  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      barcode: item.barcode || '',
      quantity: String(item.quantity),
      unit: item.unit || '',
      price: String(item.price),
      cost: String(item.cost || 0),
      expired_at: item.expired_at ? item.expired_at.split('T')[0] : '',
      description: item.description || '',
      note: item.note || '',
      category_id: item.category?.id?.toString() || '',
      location_id: item.location?.id?.toString() || '',
    })
    setShowModal(true)
  }

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)

  const handleDelete = async (id: number) => {
    const target = items.find(i => i.id === id)
    if (!target) return
    setDeleteTarget(target)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    // 离线模式：记录删除操作
    if (!navigator.onLine) {
      await recordOfflineOp('delete', 'items', { id: deleteTarget.id })
      // 从本地缓存中移除
      const updatedItems = items.filter(item => item.id !== deleteTarget.id)
      setItems(updatedItems)
      await offlineDB.removeCachedItem(deleteTarget.id)
      setDeleteTarget(null)
      return
    }

    // 在线模式
    try {
      await api.deleteItem(deleteTarget.id)
      setDeleteTarget(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete:', error)
      // API 失败时降级到离线删除
      await recordOfflineOp('delete', 'items', { id: deleteTarget.id })
      const updatedItems = items.filter(item => item.id !== deleteTarget.id)
      setItems(updatedItems)
      setDeleteTarget(null)
    }
  }

  const resetForm = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      barcode: '',
      quantity: '',
      unit: '',
      price: '',
      cost: '',
      expired_at: '',
      description: '',
      note: '',
      category_id: '',
      location_id: '',
    })
  }

  // AI Recognition handlers
  const handleAIFileSelect = async (file: File) => {
    setSelectedFile(file)
    setIsRecognizing(true)
    setShowAIUpload(false)

    try {
      // 验证文件
      const validation = validateImageFile(file, 10)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // 决定使用哪种OCR方式
      const useServerAI = aiStatus?.configured
      const useBrowserOCR = !useServerAI && aiStatus?.browserOCR

      if (useBrowserOCR) {
        // 使用浏览器端Tesseract.js OCR
        console.log('Using browser OCR...')
        const result = await browserOCR(file, (progress) => {
          console.log(`OCR Progress: ${progress.status} - ${progress.progress}%`)
        })

        // 转换为AIResult格式
        setAIResult({
          items: result.items.map((item, index) => ({
            name: item.name || '',
            barcode: item.barcode,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
            confidence: item.confidence,
          })),
          provider: 'Browser OCR (Tesseract.js)',
          model: 'eng+chi_sim',
        })
      } else if (useServerAI) {
        // 使用服务器端AI OCR
        // 压缩图片（如果太大）
        let fileToUpload = file
        const maxSizeKB = 1024 // 1MB
        if (file.size > maxSizeKB * 1024) {
          console.log(`Compressing image: ${(file.size / 1024).toFixed(1)}KB ->...`)
          try {
            const compressed = await compressImage(file, {
              maxWidth: 1920,
              maxHeight: 1920,
              quality: 0.8,
              maxSizeKB: maxSizeKB,
            })
            fileToUpload = new File([compressed], file.name, { type: 'image/jpeg' })
            console.log(`Compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(fileToUpload.size / 1024).toFixed(1)}KB`)
          } catch (compressError) {
            console.warn('Compression failed, using original file:', compressError)
          }
        }

        const result = await api.recognizeFromImage(fileToUpload, recognitionType)
        setAIResult({
          items: result.items,
          provider: result.provider,
          model: result.model,
        })
      } else {
        // 两种都不可用
        throw new Error('无可用的OCR方式。请配置AI服务或使用条码扫描功能。')
      }
    } catch (error) {
      console.error('AI recognition failed:', error)
      alert(tAi('recognitionFailed') + ': ' + (error as Error).message)
    } finally {
      setIsRecognizing(false)
      setSelectedFile(null)
    }
  }

  const handleAIConfirm = async (items: Array<{
    name: string
    barcode?: string
    quantity: number
    unit?: string
    price?: number
    cost?: number
    expired_at?: string
    description?: string
    category_id?: number
    location_id?: number
  }>) => {
    try {
      const result = await api.batchCreateItems(items)
      setAIResult(null)
      loadData()
      alert(tAi('batchSuccess', { count: result.created }) + (result.failed > 0 ? ` (${result.failed} failed)` : ''))
    } catch (error) {
      console.error('Failed to create items:', error)
      alert(tAi('batchFailed') + ': ' + (error as Error).message)
    }
  }

  const openAIUpload = (type: RecognitionType) => {
    setRecognitionType(type)
    setShowAIUpload(true)
  }

  // Barcode scanner handlers
  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false)

    if (scannerMode === 'lookup') {
      // Lookup mode: search for existing item
      try {
        const item = await api.getItemByBarcode(barcode)
        // Show item details or edit modal
        handleEdit(item)
      } catch (error) {
        // Item not found, switch to add mode with barcode pre-filled
        setFormData({
          ...formData,
          barcode: barcode,
          name: '',
        })
        setShowModal(true)
      }
    } else {
      // Add mode: pre-fill barcode in form
      try {
        // First check if item exists
        const existingItem = await api.getItemByBarcode(barcode)
        // If exists, show edit modal
        handleEdit(existingItem)
      } catch {
        // Not found, pre-fill barcode in add form
        setFormData({
          ...formData,
          barcode: barcode,
          name: '',
        })
        setShowModal(true)
      }
    }
  }

  const openScanner = (mode: 'lookup' | 'add') => {
    setScannerMode(mode)
    setShowScanner(true)
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">物品管理</h1>
          <p className="text-muted-foreground">管理您的库存物品</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => openScanner('add')}>
            <ScanLine className="h-4 w-4 mr-2" />
            扫码添加
          </Button>
          {aiStatus?.configured && (
            <Button
              variant="outline"
              onClick={() => openAIUpload('product')}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              AI 识别
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowModal(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            添加物品
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索物品名称或条码..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <select
              className="h-9 px-3 rounded-md border border-input bg-background"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              className="h-9 px-3 rounded-md border border-input bg-background"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">全部位置</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items list */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无物品，点击添加按钮创建您的第一个物品</p>
            {aiStatus?.configured && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => openAIUpload('product')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                使用 AI 快速录入
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.barcode && (
                      <p className="text-xs text-muted-foreground">条码: {item.barcode}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">数量</span>
                    <span className="font-medium">{item.quantity} {item.unit}</span>
                  </div>
                  {item.price > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">价格</span>
                      <span>¥{item.price.toFixed(2)}</span>
                    </div>
                  )}
                  {item.category && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">分类</span>
                      <span>{item.category.name}</span>
                    </div>
                  )}
                  {item.location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">位置</span>
                      <span>{item.location.name}</span>
                    </div>
                  )}
                  {item.expired_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">过期</span>
                      <span className={new Date(item.expired_at) < new Date() ? 'text-destructive' : ''}>
                        {new Date(item.expired_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingItem ? '编辑物品' : '添加物品'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="barcode">条码</Label>
                    <div className="flex gap-2">
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                          setScannerMode('add')
                          setShowScanner(true)
                        }}
                        title="扫描条形码"
                      >
                        <Barcode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">数量</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">单位</Label>
                    <Input
                      id="unit"
                      placeholder="个、盒、箱"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">价格</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category_id">分类</Label>
                    <select
                      id="category_id"
                      className="w-full h-9 px-3 rounded-md border border-input bg-background"
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                      <option value="">选择分类</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location_id">位置</Label>
                    <select
                      id="location_id"
                      className="w-full h-9 px-3 rounded-md border border-input bg-background"
                      value={formData.location_id}
                      onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    >
                      <option value="">选择位置</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expired_at">过期日期</Label>
                  <Input
                    id="expired_at"
                    type="date"
                    value={formData.expired_at}
                    onChange={(e) => setFormData({ ...formData, expired_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">备注</Label>
                  <Input
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                    取消
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingItem ? '保存' : '添加'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* AI Upload Modal */}
      {showAIUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{tAi('title')}</h2>

              {/* Recognition type selector */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <Button
                  variant={recognitionType === 'product' ? 'default' : 'outline'}
                  className="flex-col h-auto py-3"
                  onClick={() => setRecognitionType('product')}
                >
                  <Camera className="h-5 w-5 mb-1" />
                  <span className="text-xs">{tAi('typeProduct')}</span>
                </Button>
                <Button
                  variant={recognitionType === 'receipt' ? 'default' : 'outline'}
                  className="flex-col h-auto py-3"
                  onClick={() => setRecognitionType('receipt')}
                >
                  <Receipt className="h-5 w-5 mb-1" />
                  <span className="text-xs">{tAi('typeReceipt')}</span>
                </Button>
                <Button
                  variant={recognitionType === 'barcode' ? 'default' : 'outline'}
                  className="flex-col h-auto py-3"
                  onClick={() => setRecognitionType('barcode')}
                >
                  <ScanLine className="h-5 w-5 mb-1" />
                  <span className="text-xs">{tAi('typeBarcode')}</span>
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {recognitionType === 'product' && tAi('descProduct')}
                {recognitionType === 'receipt' && tAi('descReceipt')}
                {recognitionType === 'barcode' && tAi('descBarcode')}
              </p>

              <FileUpload
                onFileSelect={handleAIFileSelect}
                accept="image/*,.pdf"
              />

              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => setShowAIUpload(false)}>
                  {tCommon('cancel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Recognition Loading */}
      {isRecognizing && (
        <RecognitionLoading
          provider={aiStatus?.provider}
          model="processing"
        />
      )}

      {/* AI Result Modal */}
      {aiResult && (
        <AIResultModal
          items={aiResult.items}
          provider={aiResult.provider}
          model={aiResult.model}
          categories={categories}
          locations={locations}
          onConfirm={handleAIConfirm}
          onCancel={() => setAIResult(null)}
        />
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">删除物品</h2>
                  <p className="text-sm text-muted-foreground">此操作不可撤销</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                确定要删除物品 <span className="font-medium text-foreground">{deleteTarget.name}</span> 吗？
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                  取消
                </Button>
                <Button variant="destructive" className="flex-1" onClick={confirmDelete}>
                  删除
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
