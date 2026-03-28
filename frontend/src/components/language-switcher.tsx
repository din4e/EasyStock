"use client"

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'

const languages = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: 'English' },
]

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const router = useRouter()

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return

    startTransition(() => {
      // 设置 cookie，有效期一年
      document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`
      // 刷新页面以应用新语言
      router.refresh()
    })
  }

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