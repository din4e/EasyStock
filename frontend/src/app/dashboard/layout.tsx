"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Package, LogOut, LayoutDashboard, Tags, MapPin, Menu, X, Users } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, mounted, logout, isAdmin } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push('/')
    }
  }, [user, loading, mounted, router])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  // SSR: 显示加载状态，避免 hydration 不匹配
  if (!mounted || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
    { href: '/dashboard/items', icon: Package, label: '物品管理' },
    { href: '/dashboard/categories', icon: Tags, label: '分类管理' },
    { href: '/dashboard/locations', icon: MapPin, label: '位置管理' },
    ...(isAdmin ? [{ href: '/dashboard/users', icon: Users, label: '用户管理' }] : []),
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="font-semibold">EasyStock</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <div className="fixed left-0 top-0 h-full w-64 bg-card border-r p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6">
              <Package className="h-6 w-6 text-primary" />
              <span className="font-semibold">EasyStock</span>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-3 px-3 py-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">{user.username[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{user.nickname || user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen border-r bg-card fixed h-full">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">EasyStock</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-3 py-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium">{user.username[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-medium">{user.nickname || user.username}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-6 pt-16 lg:pt-6">
        {children}
      </main>
    </div>
  )
}
