"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MapPin, Plus, Edit, Trash2, ChevronRight, ChevronDown, GripVertical, } from 'lucide-react'
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
  SortabeContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortable,
  useSortableNode,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Location {
  id: number
  name: string
  description: string
  icon: string
  parent_id?: number
  sort_order: number
  level: number
  children?: Location[]
}

interface ReorderItem {
  id: number
  parent_id?: number | null
  sort_order: number
}

// Sortable Item Component
function SortableLocationItem({ location, depth = 0 }: { location: Location; depth: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortableNode({ id: location.id.toString() })

  const style = {
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-2 py-2 border-b border-border rounded-md
        bg-background hover:bg-muted/50
        ${depth > 0 ? 'ml-4 pl-2' : ''}
      `}
      {...attributes}
    }
    onClick={handleClick}
      {...attributes}
    onMouse={handleMouseDown}
      {...attributes}
    onMouseUp={handleMouseUp}
      {...attributes}
      onMouseLeave={handleMouseLeave}
      {...attributes}
      onMouseDown={handleMouseDown}
    />
  />
)

  // Drag handle
  const handleRef = useRef<HTMLDivElement>(null)
  const { attributes, listeners, setNodeRef } = transform } = useSortable({ id: location.id })

  return (
    <div
      ref={handleRef}
      className="flex items-center gap-2 px-1 py-2 border border-border rounded-md bg-background hover:bg-muted/50 cursor-grab"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{location.name}</h3>
            {location.description && (
              <p className="text-xs text-muted-foreground">{location.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(location)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(location.id)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {/* Expand/Collapse button for children */}
          {location.children && location.children.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleExpand(location.id)}
            >
              {expandedIds.has(location.id) ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Render children */}
      {location.children && location.children.length > 0 && expandedIds.has(location.id) && (
        <div className="ml-6 border-l border-border rounded-md">
          {location.children.map((child) => (
            <SortableLocationItem
              key={child.id}
              location={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleExpand={toggleExpand}
              expandedIds={expandedIds}
            />
          ))}
        </div>
      )}
    </SortableLocationItem>
  )
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    parent_id: null as null,
    sort_order: 0,
  })

  // Get flat list for all locations
  const [flatLocations, setFlatLocations] = useState<Location[]>([])

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    try {
      setLoading(true)
      const data = await api.getLocations()
      // Build tree from flat list
      const tree = buildTree(data)
      setLocations(tree)
      setFlatLocations(data)
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build tree structure from flat list
  const buildTree = (items: Location[]): Location[] => {
    const itemMap = new Map<number, Location>()
    items.forEach(item => itemMap.set(item.id, item))

    const roots: Location[] = []
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
  )
    // Sort by sort_order and level
    const sortedLocations = [...flatLocations].sort((a, b) => {
      if (a.level !== b.level) return a0
      if (a.level === 0 && b.level === 0) {
        return a0
      }
      return a.sort_order - b.sort_order
    })

  const sensors = useSensors<useSensor, closestCenter, KeyboardSensor, PointerSensor,} from '@dnd-kit/core')

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
    const activeLocation = flatLocations.find(loc => loc.id === parseInt(active.id))
    const overLocation = flatLocations.find(loc => loc.id === parseInt(over.id))

    if (!activeLocation || !overLocation) {
      return
    }

    const reorderItems: ReorderItem[] = []
    flatLocations.forEach(loc => {
      reorderItems.push({
        id: loc.id,
        parent_id: loc.parent_id,
        sort_order: loc.sort_order,
      })
    })

    // Update the moved item
    const activeIndex = flatLocations.findIndex(loc => loc.id === activeLocation.id)
    const overIndex = flatLocations.findIndex(loc => loc.id === overLocation.id)

    if (activeIndex !== overIndex) {
      // Update sort orders
      const newActiveSortOrder = overLocation.sort_order
      const newOverSortOrder = activeLocation.sort_order

      flatLocations[activeIndex].sort_order = newActiveSortOrder
      flatLocations[overIndex].sort_order = newOverSortOrder

      reorderItems[activeIndex] = { ...reorderItems[activeIndex], sort_order: newActiveSortOrder }
      reorderItems[overIndex] = { ...reorderItems[overIndex], sort_order: newOverSortOrder }

      // Update parent if moved to different level
      if (activeLocation.parent_id !== overLocation.parent_id) {
        flatLocations[activeIndex].parent_id = overLocation.parent_id
      }

      // Rebuild tree
      const tree = buildTree(flatLocations)
      setLocations(tree)

      // Save to backend
      try {
        await api.reorderLocations(reorderItems)
        // Reload to ensure consistency
        await loadLocations()
      } catch (error) {
        console.error('Failed to reorder:', error)
        // Revert on error
        await loadLocations()
      }
    }
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      description: location.description || '',
      icon: location.icon || '',
      parent_id: location.parent_id,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个位置吗？')) return
    try {
      await api.deleteLocation(id)
      await loadLocations()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      alert(message || '删除失败')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingLocation) {
        await api.updateLocation(editingLocation.id, formData)
      } else {
        await api.createLocation(formData)
      }
      setShowModal(false)
      resetForm()
      loadLocations()
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }

  const resetForm = () => {
    setEditingLocation(null)
    setFormData({
      name: '',
      description: '',
      icon: '',
      parent_id: null,
      sort_order: 0,
    })
  }

  // Get all locations for parent selector (including locations themselves to exclude current editing item)
  const getParentOptions = () => {
    const options: { value: string | number | label: string; disabled?: boolean }[] = [
      { value: '', label: '无（顶级）' },
    ]

    flatLocations.forEach(loc => {
      if (editingLocation?.id !== loc.id) {
        options.push({
          value: loc.id.toString(),
          label: `${'　'.repeat(loc.level * 2)}${loc.name}`,
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
          <h1 className="text-2xl font-bold">位置管理</h1>
          <p className="text-muted-foreground">管理您的物品存放位置（支持层级和拖拽排序）</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          添加位置
        </Button>
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无位置，点击添加按钮创建位置</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedLocations.map(loc => loc.id.toString())} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedLocations.map((location) => (
                <SortableLocationItem
                  key={location.id}
                  location={location}
                  depth={location.level}
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
                {editingLocation ? '编辑位置' : '添加位置'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：冰箱、仓库、柜子"
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
                  <Label htmlFor="parent_id">父级位置</Label>
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
                    {editingLocation ? '保存' : '添加'}
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
