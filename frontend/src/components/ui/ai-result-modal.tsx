"use client"

import { useState } from 'react'
import { Check, X, AlertTriangle, Edit2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export interface RecognizedItem {
  name: string
  barcode?: string
  quantity?: number
  unit?: string
  price?: number
  cost?: number
  expired_at?: string
  description?: string
  category?: string
  brand?: string
  confidence: number
}

interface AIResultModalProps {
  items: RecognizedItem[]
  provider: string
  model: string
  categories: Array<{ id: number; name: string }>
  locations: Array<{ id: number; name: string }>
  onConfirm: (items: Array<{
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
  }>) => void
  onCancel: () => void
}

export function AIResultModal({
  items: initialItems,
  provider,
  model,
  categories,
  locations,
  onConfirm,
  onCancel,
}: AIResultModalProps) {
  const [items, setItems] = useState<RecognizedItem[]>(initialItems)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return '高'
    if (confidence >= 0.5) return '中'
    return '低'
  }

  const updateItem = (index: number, updates: Partial<RecognizedItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const toggleEdit = (index: number) => {
    setEditingIndex(editingIndex === index ? null : index)
  }

  const handleConfirm = () => {
    const confirmedItems = items.map(item => ({
      name: item.name,
      barcode: item.barcode,
      quantity: item.quantity || 1,
      unit: item.unit,
      price: item.price,
      cost: item.cost,
      expired_at: item.expired_at,
      description: item.description,
    }))
    onConfirm(confirmedItems)
  }

  const lowConfidenceCount = items.filter(i => i.confidence < 0.5).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">AI 识别结果</h2>
              <p className="text-sm text-muted-foreground mt-1">
                识别到 {items.length} 个物品 · {provider} / {model}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {lowConfidenceCount > 0 && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">
                有 {lowConfidenceCount} 个物品置信度较低，建议检查
              </span>
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {items.map((item, index) => (
              <Card key={index} className={item.confidence < 0.5 ? 'border-yellow-300' : ''}>
                <CardContent className="pt-4">
                  {editingIndex === index ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>名称 *</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(index, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>条码</Label>
                          <Input
                            value={item.barcode || ''}
                            onChange={(e) => updateItem(index, { barcode: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>数量</Label>
                          <Input
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>单位</Label>
                          <Input
                            value={item.unit || ''}
                            onChange={(e) => updateItem(index, { unit: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>价格</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price || ''}
                            onChange={(e) => updateItem(index, { price: parseFloat(e.target.value) || undefined })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>过期日期</Label>
                          <Input
                            type="date"
                            value={item.expired_at || ''}
                            onChange={(e) => updateItem(index, { expired_at: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>描述</Label>
                          <Input
                            value={item.description || ''}
                            onChange={(e) => updateItem(index, { description: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button size="sm" onClick={() => toggleEdit(index)}>
                        <Check className="h-4 w-4 mr-1" /> 完成
                      </Button>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{item.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(item.confidence)} bg-opacity-10`}>
                            置信度: {getConfidenceLabel(item.confidence)} ({(item.confidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
                          {item.barcode && <div>条码: {item.barcode}</div>}
                          {item.quantity !== undefined && <div>数量: {item.quantity} {item.unit || ''}</div>}
                          {item.price !== undefined && <div>价格: ¥{item.price.toFixed(2)}</div>}
                          {item.category && <div>分类: {item.category}</div>}
                          {item.brand && <div>品牌: {item.brand}</div>}
                          {item.expired_at && <div>过期: {item.expired_at}</div>}
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleEdit(index)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              没有识别到任何物品
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            确认后将添加 {items.length} 个物品到库存
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={items.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              确认添加
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
