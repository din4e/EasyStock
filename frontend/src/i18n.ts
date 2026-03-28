import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

// 支持的语言列表
export const locales = ['zh-CN', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'zh-CN'

export default getRequestConfig(async () => {
  // 从 cookie 读取语言设置
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')
  const locale = (localeCookie?.value as Locale) || defaultLocale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  }
})
