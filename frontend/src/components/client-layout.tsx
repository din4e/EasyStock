"use client"

import { NextIntlClientProvider } from 'next-intl'
import { AuthProvider } from '@/hooks/useAuth'
import { PWARegister } from '@/components/pwa-register'
import { ReactNode } from 'react'

export function ClientLayout({
  children,
  locale,
  messages,
}: {
  children: ReactNode
  locale: string
  messages: Record<string, unknown>
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages as Record<string, Record<string, unknown>>}>
      <AuthProvider>
        {children}
        <PWARegister />
      </AuthProvider>
    </NextIntlClientProvider>
  )
}
