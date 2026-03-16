"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tags, Plus, Edit, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'

interface Category {
  id: number
  name: string
  description: string
  color: string
  icon: string
  parent_id?: number | null
  sort_order: number
  level: number
  children?: Category[]
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: '',
    parent_id: null as number | null,
    sort_order: 0,
  })

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await api.getCategories()
      // Build tree from flat list
      const tree = buildTree(data)
      setCategories(tree)
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build tree structure from flat list
  const buildTree = (items: Category[]): Category[] => {
    const itemMap = new Map<number, Category>()
    items.forEach(item => {
      item.children = []
      itemMap.set(item.id, item)
    })

    const roots: Category[] = []
    items.forEach(item => {
      if (item.parent_id === null || item.parent_id === undefined) {
        roots.push(item)
      } else if (itemMap.has(item.parent_id)) {
        const parent = itemMap.get(item.parent_id)!
        parent.children = parent.children || []
        parent.children.push(item)
      }
    })

    // Sort by sort_order
    roots.sort((a, b) => a.sort_order - b.sort_order)
    roots.forEach(root => {
      if (root.children) {
        root.children.sort((a, b) => a.sort_order - b.sort_order)
      }
    })

    return roots
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3b82f6',
      icon: category.icon || '',
      parent_id: category.parent_id ?? null,
      sort_order: category.sort_order,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个分类吗？')) return
    try {
      await api.deleteCategory(id)
      await loadCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      alert(message || '删除失败')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, formData)
      } else {
        await api.createCategory(formData)
      }
      setShowModal(false)
      resetForm()
      loadCategories()
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }

  const resetForm = () => {
    setEditingCategory(null)
    setFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      icon: '',
      parent_id: null,
      sort_order: 0,
    })
  }

  // Get all categories for parent selector
  const getParentOptions = (items: Category[], level = 0): Array<{ value: string; label: string; disabled?: boolean }> => {
    let options: Array<{ value: string; label: string; disabled?: boolean }> = []
    items.forEach(item => {
      if (editingCategory?.id !== item.id) {
        options.push({
          value: item.id.toString(),
          label: `${'\u3000'.repeat(level * 2)}${item.name}`,
        })
        if (item.children && item.children.length > 0) {
          options = options.concat(getParentOptions(item.children, level + 1))
        }
      }
    })
    return options
  }

  // Render category tree
  const renderCategoryTree = (items: Category[], depth = 0) => {
    return items.map((category) => (
      <div key={category.id} className={`${depth > 0 ? 'ml-6 border-l border-border pl-2' : ''}`}>
        <div className="flex items-center justify-between p-3 border border-border rounded-md bg-background hover:bg-muted/50 mb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: category.color || '#3b82f6' }}
            >
              <Tags className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{category.name}</h3>
              {category.description && (
                <p className="text-xs text-muted-foreground">{category.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(category.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          renderCategoryTree(category.children, depth + 1)
        )}
      </div>
    ))
  }

  if (loading) {
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
          <h1 className="text-2xl font-bold">分类管理</h1>
          <p className="text-muted-foreground">管理您的物品分类（支持层级结构）</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          添加分类
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tags className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无分类，点击添加按钮创建分类</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {renderCategoryTree(categories)}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingCategory ? '编辑分类' : '添加分类'}
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
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">颜色</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      className="w-16 h-9 p-1"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_id">父级分类</Label>
                  <select
                    id="parent_id"
                    value={formData.parent_id?.toString() || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      parent_id: e.target.value ? parseInt(e.target.value) : null
                    })}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="">无（顶级）</option>
                    {getParentOptions(categories).map(option => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                    取消
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingCategory ? '保存' : '添加'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
