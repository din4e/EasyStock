"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, TrendingUp, AlertTriangle, DollarSign, ArrowDown, ArrowUp, ScanLine, Plus, Tags, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Stats {
  total_items: number
  total_value: number
  expiring_soon: number
  out_of_stock: number
  low_stock: number
  recent_in: number
  recent_out: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const statCards = [
    {
      title: '总物品数',
      value: stats?.total_items || 0,
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: '库存总值',
      value: `¥${(stats?.total_value || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: '即将过期',
      value: stats?.expiring_soon || 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      title: '库存不足',
      value: stats?.low_stock || 0,
      icon: TrendingUp,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground">欢迎回来！以下是您的库存概览。</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">本周入库/出库</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <ArrowDown className="h-5 w-5 text-green-500" />
                  <span>入库</span>
                </div>
                <span className="font-semibold text-green-600">{stats?.recent_in || 0} 件</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <ArrowUp className="h-5 w-5 text-red-500" />
                  <span>出库</span>
                </div>
                <span className="font-semibold text-red-600">{stats?.recent_out || 0} 件</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/dashboard/items?action=scan" className="group">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 hover:from-blue-100 dark:hover:from-blue-950/60 hover:to-blue-100/70 dark:hover:to-blue-900/30 border border-blue-200/50 dark:border-blue-800/30 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                <div className="p-2.5 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <ScanLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">扫码添加</span>
              </div>
            </Link>
            <Link href="/dashboard/items?action=add" className="group">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20 hover:from-green-100 dark:hover:from-green-950/60 hover:to-green-100/70 dark:hover:to-green-900/30 border border-green-200/50 dark:border-green-800/30 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                <div className="p-2.5 rounded-full bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                  <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">手动添加</span>
              </div>
            </Link>
            <Link href="/dashboard/categories" className="group">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 hover:from-purple-100 dark:hover:from-purple-950/60 hover:to-purple-100/70 dark:hover:to-purple-900/30 border border-purple-200/50 dark:border-purple-800/30 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                <div className="p-2.5 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Tags className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">分类管理</span>
              </div>
            </Link>
            <Link href="/dashboard/locations" className="group">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20 hover:from-orange-100 dark:hover:from-orange-950/60 hover:to-orange-100/70 dark:hover:to-orange-900/30 border border-orange-200/50 dark:border-orange-800/30 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                <div className="p-2.5 rounded-full bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                  <MapPin className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">位置管理</span>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {(stats?.expiring_soon || 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium">您有 {stats?.expiring_soon} 件物品即将过期</p>
                <Link href="/dashboard/items?filter=expiring" className="text-sm text-primary hover:underline">
                  查看详情
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
