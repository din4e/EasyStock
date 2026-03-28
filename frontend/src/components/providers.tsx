"use client"

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { AuthProvider } from '@/hooks/useAuth'
import { PWARegister } from '@/components/pwa-register'
import { ReactNode } from 'react'

export function Providers({
  children,
  locale,
}: {
  children: ReactNode
  locale: string
}) {
  return (
    <NextIntlClientProvider locale={locale}>
      <AuthProvider>
        {children}
        <PWARegister />
      </AuthProvider>
    </NextIntlClientProvider>
  )
}
