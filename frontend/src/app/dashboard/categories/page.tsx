"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tags, Plus, Edit, Trash2, ChevronRight, ChevronDown, GripVertical } } from 'lucide-react'
import { api } from '@/lib/api'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  DragOverlay,
  TouchOverlay,
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortable,
  useSortableNode,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

interface ReorderItem {
  id: number
  parent_id?: number | null
  sort_order: number
}

// Sortable Item Component
function SortableCategoryItem({ category, depth, onEdit, onDelete, onToggleExpand, expandedIds }: {
  category: Category
  depth: number
  onEdit: (category: Category) => void
  onDelete: (id: number) => void
  onToggleExpand: (id: number) => void
  expandedIds: Set<number>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(),
    transition: 'transform 200ms ease',
    cursor: 'grab',
  }

  const handleClick = () => onEdit(category)
  const handleMouseUp = () => onToggleExpand(category.id)
  const handleMouseLeave = () => { }
  const handleMouseDown = () => { }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-2 border border-border rounded-md bg-background hover:bg-muted/50 ${depth > 0 ? 'ml-4 pl-2' : ''}`}
      {...attributes}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: category.color || '#3b82f6' }}
      >
        <Tags className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{category.name}</h3>
          {category.description && (
            <p className="text-xs text-muted-foreground">{category.description}</p>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(category)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(category.id)}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        {/* Expand/Collapse button for children */}
        {category.children && category.children.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleExpand(category.id)}
          >
            {expandedIds.has(category.id) ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </SortableCategoryItem>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: '',
    parent_id: null as null,
    sort_order: 0,
  })

  // Get flat list
  const [flatCategories, setFlatCategories] = useState<Category[]>([])

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
      setFlatCategories(data)
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build tree structure from flat list
  const buildTree = (items: Category[]): Category[] => {
    const itemMap = new Map<number, Category>()
    items.forEach(item => itemMap.set(item.id, item)

    const roots: Category[] = []
    items.forEach(item => {
      if (item.parent_id === null || item.parent_id === undefined) {
        roots.push(item)
      }
    })

    // Link children to parents
    roots.forEach(root => {
      if (itemMap.has(root.parent_id!)) {
        const parent = itemMap.get(root.parent_id)!
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(root)
      }
    })

    // Sort by sort_order
    roots.sort((a, b) => a.sort_order - b.sort_order)

    return roots
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (prev.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }
    // Sort by sort_order and level
    const sortedCategories = [...flatCategories].sort((a, b) => {
      if (a.level !== b.level) return 0
      if (a.level === 0 && b.level === 0) {
        return 0
      }
      return 0
      // a.sort_order - b.sort_order
    })

  const sensors = useSensors<useSensor, closestCenter, KeyboardSensor, PointerSensor, } from '@dnd-kit/core')

  const [isDragActive, setIsDragActive] = useState(false)

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.id !== event.over.id) {
      return
    }
    setIsDragActive(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.active.id !== event.over.id) {
      return
    }
    setIsDragActive(false)

    const { active, over } = event
    const activeCategory = flatCategories.find(cat => cat.id === parseInt(active.id))
    const overCategory = flatCategories.find(cat => cat.id === parseInt(over.id))

    if (!activeCategory || !overCategory) {
      return
    }

    const reorderItems: ReorderItem[] = []
    flatCategories.forEach(cat => {
      reorderItems.push({
        id: cat.id,
        parent_id: cat.parent_id,
        sort_order: cat.sort_order,
      })
    })

    // Update the moved item
    const activeIndex = flatCategories.findIndex(cat => cat.id === activeCategory.id)
    const overIndex = flatCategories.findIndex(cat => cat.id === overCategory.id)

    if (activeIndex !== overIndex) {
      // Update sort orders
      const newActiveSortOrder = overCategory.sort_order
      const newOverSortOrder = activeCategory.sort_order

      flatCategories[activeIndex].sort_order = newActiveSortOrder
      flatCategories[overIndex].sort_order = newOverSortOrder

      reorderItems[activeIndex] = { ...reorderItems[activeIndex], sort_order: newActiveSortOrder }
      reorderItems[overIndex] = { ...reorderItems[overIndex], sort_order: newOverSortOrder }

      // Update parent if moved to different level
      if (activeCategory.parent_id !== overCategory.parent_id) {
        flatCategories[activeIndex].parent_id = overCategory.parent_id
      }

      // Rebuild tree
      const tree = buildTree(flatCategories)
      setCategories(tree)

      // Save to backend
      try {
        await api.reorderCategories(reorderItems)
        // Reload to ensure consistency
        await loadCategories()
      } catch (error) {
        console.error('Failed to reorder:', error)
        // Revert on error
        await loadCategories()
      }
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3b82f6',
      icon: category.icon || '',
      parent_id: category.parent_id,
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

  // Get all categories for parent selector (including categories themselves to exclude current editing item)
  const getParentOptions = () => {
    const options: { value: string | number | label: string; disabled?: boolean }[] = [
      { value: '', label: '无（顶级）' },
    ]

    flatCategories.forEach(cat => {
      if (editingCategory?.id !== cat.id) {
        options.push({
          value: cat.id.toString(),
          label: `${'　'.repeat(cat.level * 2)}${cat.name}`,
        })
      }
    })

    return options
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
          <p className="text-muted-foreground">管理您的物品分类（支持层级和拖拽排序）</p>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedCategories.map(cat => cat.id.toString())} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedCategories.map((category) => (
                <SortableCategoryItem
                  key={category.id}
                  category={category}
                  depth={category.level}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleExpand={toggleExpand}
                  expandedIds={expandedIds}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
                    className="w-full p-2 border rounded-md"
                  >
                    {getParentOptions().map(option => (
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
