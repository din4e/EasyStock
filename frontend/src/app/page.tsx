"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Settings } from 'lucide-react'

export default function Home() {
  const { user, loading, mounted, login, register } = useAuth()
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState('')
  const [showApiSettings, setShowApiSettings] = useState(false)
  const [apiUrl, setApiUrl] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    nickname: '',
  })

  useEffect(() => {
    if (mounted && !loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, mounted, router])

  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('api_url')
      if (saved) {
        setApiUrl(saved)
      } else {
        // 自动检测当前主机
        const { protocol, hostname } = window.location
        setApiUrl(`${protocol}//${hostname}:8080/api/v1`)
      }
    }
  }, [mounted])

  const handleSaveApiUrl = () => {
    const trimmed = apiUrl.trim()
    if (trimmed) {
      localStorage.setItem('api_url', trimmed)
      setShowApiSettings(false)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (isLogin) {
        await login(formData.username, formData.password)
      } else {
        await register(formData.username, formData.email, formData.password, formData.nickname)
      }
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  // SSR: 显示加载状态，避免 hydration 不匹配
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Package className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">EasyStock</CardTitle>
          <CardDescription>
            {isLogin ? '登录到您的账户' : '创建新账户'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showApiSettings ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">API 服务器地址</Label>
                <Input
                  id="apiUrl"
                  placeholder="http://192.168.1.100:8080/api/v1"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  手机访问时需设置为电脑的局域网IP地址
                </p>
              </div>
              <Button onClick={handleSaveApiUrl} className="w-full">
                保存并继续
              </Button>
              <Button variant="ghost" onClick={() => setShowApiSettings(false)} className="w-full">
                取消
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">邮箱</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname">昵称</Label>
                      <Input
                        id="nickname"
                        placeholder="您的昵称"
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    placeholder="用户名"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="密码"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full">
                  {isLogin ? '登录' : '注册'}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                {isLogin ? '还没有账户？' : '已有账户？'}
                <button
                  type="button"
                  className="text-primary hover:underline ml-1"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError('')
                  }}
                >
                  {isLogin ? '立即注册' : '立即登录'}
                </button>
              </div>
            </>
          )}
        </CardContent>
        {!showApiSettings && (
          <div className="px-6 pb-4 flex justify-center">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              onClick={() => {
                setShowApiSettings(true)
                setError('')
              }}
            >
              <Settings className="h-3 w-3" />
              设置服务器地址
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
