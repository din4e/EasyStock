"use client"

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: string) => {
    startTransition(() => {
      // Replace the current locale in the pathname
      const segments = pathname.split('/')
      segments[1] = newLocale
      router.push(segments.join('/'))
    })
  }

  const languages = [
    { code: 'zh-CN', label: '中文' },
    { code: 'en', label: 'English' },
  ]

  return (
    <div className="flex items-center gap-1">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <select
        value={locale}
        onChange={(e) => switchLocale(e.target.value)}
        disabled={isPending}
        className="bg-transparent text-sm border-none outline-none cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  )
}
