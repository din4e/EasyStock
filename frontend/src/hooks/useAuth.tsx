"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '@/lib/api'

interface User {
  id: number
  username: string
  email: string
  nickname: string
  role: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  mounted: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, nickname?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // 只在客户端挂载后才执行
  useEffect(() => {
    setMounted(true)

    const token = localStorage.getItem('token')
    if (token) {
      api.getProfile()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const { user } = await api.login(username, password)
    setUser(user)
  }

  const register = async (username: string, email: string, password: string, nickname?: string) => {
    const { user } = await api.register(username, email, password, nickname)
    setUser(user)
  }

  const logout = () => {
    api.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, mounted, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
