"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Shield, ShieldCheck, ShieldAlert, Trash2, Edit, Key, UserX, UserCheck } from 'lucide-react'

interface User {
  id: number
  username: string
  email: string
  nickname: string
  role: string
  is_active: boolean
  created_at: string
}

const roleConfig = {
  owner: { label: '所有者', icon: Shield, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  admin: { label: '管理员', icon: ShieldCheck, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  member: { label: '成员', icon: ShieldAlert, color: 'text-green-500 bg-green-50 dark:bg-green-950/30' },
  readonly: { label: '只读', icon: Shield, color: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30' },
}

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    loadUsers()
  }, [isAdmin])

  const loadUsers = async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.updateUser(userId, { role: newRole })
      loadUsers()
    } catch (error) {
      alert('修改角色失败: ' + (error as Error).message)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active })
      loadUsers()
    } catch (error) {
      alert('修改状态失败: ' + (error as Error).message)
    }
  }

  const handleDelete = async (user: User) => {
    if (user.role === 'owner') {
      alert('无法删除所有者')
      return
    }
    if (!confirm(`确定要删除用户「${user.nickname || user.username}」吗？此操作不可撤销。`)) return
    try {
      await api.deleteUser(user.id)
      loadUsers()
    } catch (error) {
      alert('删除失败: ' + (error as Error).message)
    }
  }

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('密码长度至少6位')
      return
    }
    try {
      await api.updatePassword(passwordUser!.id, newPassword, oldPassword || undefined)
      alert('密码修改成功')
      setShowPasswordModal(false)
      setNewPassword('')
      setOldPassword('')
      setPasswordUser(null)
    } catch (error) {
      alert('修改失败: ' + (error as Error).message)
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">只有管理员才能访问用户管理</p>
          </CardContent>
        </Card>
      </div>
    )
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
      <div>
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">管理团队成员和权限</p>
      </div>

      {/* User list */}
      <div className="space-y-4">
        {users.map((user) => {
          const config = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.member
          const RoleIcon = config.icon
          return (
            <Card key={user.id} className={!user.is_active ? 'opacity-60' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  {/* User info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <span className="text-sm font-medium">
                        {(user.nickname || user.username)[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{user.nickname || user.username}</span>
                        {!user.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">已禁用</span>
                        )}
                        {user.id === currentUser?.id && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">自己</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </div>

                  {/* Role badge */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.color}`}>
                      <RoleIcon className="h-3 w-3" />
                      {config.label}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* Role selector */}
                      {user.role !== 'owner' && (
                        <select
                          className="h-8 px-2 text-xs rounded-md border border-input bg-background"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="admin">管理员</option>
                          <option value="member">成员</option>
                          <option value="readonly">只读</option>
                        </select>
                      )}

                      {/* Toggle active */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(user)}
                        title={user.is_active ? '禁用用户' : '启用用户'}
                        disabled={user.role === 'owner'}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4 text-orange-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>

                      {/* Change password */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setPasswordUser(user); setShowPasswordModal(true) }}
                        title="修改密码"
                      >
                        <Key className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user)}
                        title="删除用户"
                        disabled={user.role === 'owner' || user.id === currentUser?.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Member count summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>总成员: {users.length}</span>
        <span>活跃: {users.filter(u => u.is_active).length}</span>
        <span>管理员: {users.filter(u => u.role === 'admin' || u.role === 'owner').length}</span>
      </div>

      {/* Password Modal */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-sm">
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">修改密码 - {passwordUser.nickname || passwordUser.username}</h2>

              {passwordUser.id === currentUser?.id && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="oldPwd">原密码</Label>
                    <Input
                      id="oldPwd"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="请输入原密码"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="newPwd">新密码</Label>
                  <Input
                    id="newPwd"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少6位"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => { setShowPasswordModal(false); setPasswordUser(null); setNewPassword(''); setOldPassword('') }}>
                  取消
                </Button>
                <Button className="flex-1" onClick={handlePasswordChange}>
                  确认修改
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
