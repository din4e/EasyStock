"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MapPin, Plus, Edit, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'

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

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    parent_id: null as number | null,
    sort_order: 0,
  })

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
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build tree structure from flat list
  const buildTree = (items: Location[]): Location[] => {
    const itemMap = new Map<number, Location>()
    items.forEach(item => {
      item.children = []
      itemMap.set(item.id, item)
    })

    const roots: Location[] = []
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

  // Get all locations for parent selector
  const getParentOptions = (items: Location[], level = 0): Array<{ value: string; label: string }> => {
    let options: Array<{ value: string; label: string }> = []
    items.forEach(item => {
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

  // Render location tree
  const renderLocationTree = (items: Location[], depth = 0) => {
    return items.map((location) => (
      <div key={location.id} className={`${depth > 0 ? 'ml-6 border-l border-border pl-2' : ''}`}>
        <div className="flex items-center justify-between p-3 border border-border rounded-md bg-background hover:bg-muted/50 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
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
            <Button variant="ghost" size="icon" onClick={() => handleEdit(location)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(location.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {location.children && location.children.length > 0 && (
          renderLocationTree(location.children, depth + 1)
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
          <h1 className="text-2xl font-bold">位置管理</h1>
          <p className="text-muted-foreground">管理您的物品存放位置</p>
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
        <div className="space-y-2">
          {renderLocationTree(locations)}
        </div>
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
                    className="w-full h-9 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="">无（顶级）</option>
                    {getParentOptions(locations).map(option => (
                      <option key={option.value} value={option.value}>
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
