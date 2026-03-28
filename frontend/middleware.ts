import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './src/i18n'

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never' // 使用 cookie 而不是 URL prefix
})

export const config = {
  matcher: [
    '/',
    '/(zh-CN|en)/:path*',
    '/((?!_next|_vercel|.*\\..*).*)'
  ]
}