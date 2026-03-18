"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MapPin, Plus, Edit, Trash2, GripVertical, Package } from 'lucide-react'
import { api } from '@/lib/api'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
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

interface Item {
  id: number
  name: string
  barcode: string
  quantity: number
  unit: string
  location_id: number
}

// Draggable item component
function DraggableItem({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `item-${item.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.quantity} {item.unit}
        </p>
      </div>
    </div>
  )
}

// Droppable location zone
function LocationDropZone({
  location,
  items,
}: {
  location: Location
  items: Item[]
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `location-${location.id}`,
    data: { type: 'location', locationId: location.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`p-3 border rounded-lg transition-colors ${
        isOver
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background hover:border-primary/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MapPin className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{location.name}</h3>
          {location.description && (
            <p className="text-xs text-muted-foreground truncate">
              {location.description}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {items.length} 件
        </span>
      </div>

      <div className="space-y-1.5 min-h-[40px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            拖拽物品到此处
          </p>
        ) : (
          items.map((item) => <DraggableItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}

// Unassigned items zone
function UnassignedZone({ items }: { items: Item[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'location-0',
    data: { type: 'location', locationId: 0 },
  })

  return (
    <div
      ref={setNodeRef}
      className={`p-3 border rounded-lg transition-colors border-dashed ${
        isOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">未分类</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {items.length} 件
        </span>
      </div>

      <div className="space-y-1.5 min-h-[40px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            无未分类物品
          </p>
        ) : (
          items.map((item) => <DraggableItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [activeItem, setActiveItem] = useState<Item | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    parent_id: null as number | null,
    sort_order: 0,
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [locationsData, itemsData] = await Promise.all([
        api.getLocations(),
        api.getItems(),
      ])
      const tree = buildTree(locationsData)
      setLocations(tree)
      setAllItems(itemsData)
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build tree structure from flat list
  const buildTree = (items: Location[]): Location[] => {
    const itemMap = new Map<number, Location>()
    items.forEach((item) => {
      item.children = []
      itemMap.set(item.id, item)
    })

    const roots: Location[] = []
    items.forEach((item) => {
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
    roots.forEach((root) => {
      if (root.children) {
        root.children.sort((a, b) => a.sort_order - b.sort_order)
      }
    })

    return roots
  }

  // Collect all location IDs including children
  const collectAllLocationIds = (locs: Location[]): number[] => {
    const ids: number[] = []
    for (const loc of locs) {
      ids.push(loc.id)
      if (loc.children && loc.children.length > 0) {
        ids.push(...collectAllLocationIds(loc.children))
      }
    }
    return ids
  }

  // Get items for a specific location (including children)
  const getItemsForLocation = (locationId: number): Item[] => {
    return allItems.filter((item) => item.location_id === locationId)
  }

  // Get unassigned items (location_id not in any location)
  const getUnassignedItems = (): Item[] => {
    const allLocationIds = collectAllLocationIds(locations)
    return allItems.filter(
      (item) =>
        item.location_id === null ||
        item.location_id === undefined ||
        !allLocationIds.includes(item.location_id)
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const itemId = String(active.id)
    if (itemId.startsWith('item-')) {
      const item = allItems.find((i) => i.id === Number(itemId.replace('item-', '')))
      setActiveItem(item || null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    const itemId = String(active.id)
    const overId = String(over.id)

    if (!itemId.startsWith('item-')) return
    if (!overId.startsWith('location-')) return

    const itemIdNum = Number(itemId.replace('item-', ''))
    const newLocationId = Number(overId.replace('location-', ''))

    const item = allItems.find((i) => i.id === itemIdNum)
    if (!item) return
    if (item.location_id === newLocationId) return

    // Optimistic update
    setAllItems((prev) =>
      prev.map((i) =>
        i.id === itemIdNum ? { ...i, location_id: newLocationId } : i
      )
    )

    setIsMoving(true)
    try {
      await api.updateItem(itemIdNum, {
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        unit: item.unit,
        location_id: newLocationId || undefined,
      })
    } catch (error) {
      console.error('Failed to move item:', error)
      // Revert on error
      setAllItems((prev) =>
        prev.map((i) =>
          i.id === itemIdNum ? { ...i, location_id: item.location_id } : i
        )
      )
      alert('移动物品失败: ' + (error as Error).message)
    } finally {
      setIsMoving(false)
    }
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      description: location.description || '',
      icon: location.icon || '',
      parent_id: location.parent_id || null,
      sort_order: location.sort_order,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个位置吗？')) return
    try {
      await api.deleteLocation(id)
      await loadData()
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
      loadData()
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

  // Get all locations for parent selector
  const getParentOptions = (
    locs: Location[],
    level = 0
  ): Array<{ value: string; label: string }> => {
    let options: Array<{ value: string; label: string }> = []
    locs.forEach((item) => {
      if (editingLocation?.id !== item.id) {
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

  // Flatten location tree for rendering
  const flattenLocations = (
    locs: Location[],
    depth = 0
  ): Array<{ location: Location; depth: number }> => {
    const result: Array<{ location: Location; depth: number }> = []
    for (const loc of locs) {
      result.push({ location: loc, depth })
      if (loc.children && loc.children.length > 0) {
        result.push(...flattenLocations(loc.children, depth + 1))
      }
    }
    return result
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">位置管理</h1>
            <p className="text-muted-foreground">
              拖拽物品卡片到不同位置进行归类
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            添加位置
          </Button>
        </div>

        {isMoving && (
          <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg z-50">
            正在移动...
          </div>
        )}

        {locations.length === 0 && allItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                暂无位置，点击添加按钮创建位置
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Unassigned items first */}
            {allItems.length > 0 && getUnassignedItems().length > 0 && (
              <UnassignedZone items={getUnassignedItems()} />
            )}

            {/* Location zones */}
            {flattenLocations(locations).map(({ location, depth }) => (
              <div
                key={location.id}
                className={depth > 0 ? 'ml-0 sm:ml-4' : ''}
              >
                <LocationDropZone
                  location={location}
                  items={getItemsForLocation(location.id)}
                />
                <div className="flex gap-1 mt-1 ml-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEdit(location)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(location.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state when locations exist but no items */}
        {locations.length > 0 && allItems.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                暂无物品，去物品管理添加物品后可在此归类
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem ? (
          <div className="flex items-center gap-2 p-2 bg-background border border-primary rounded-md shadow-lg opacity-90">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{activeItem.name}</p>
              <p className="text-xs text-muted-foreground">
                {activeItem.quantity} {activeItem.unit}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Add/Edit Modal */}
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
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="如：冰箱、仓库、柜子"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_id">父级位置</Label>
                  <select
                    id="parent_id"
                    value={formData.parent_id?.toString() || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        parent_id: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                    className="w-full h-9 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="">无（顶级）</option>
                    {getParentOptions(locations).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowModal(false)}
                  >
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
    </DndContext>
  )
}
