"use client"

import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * 离线状态指示器
 * 显示在布局底部，提示当前网络状态和待同步操作数
 */
export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync()
  const t = useTranslations('offline')

  // 在线且无待同步操作时不显示
  if (isOnline && pendingCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div
        className={`flex items-center justify-center gap-2 px-4 py-2 text-sm text-white ${
          isOnline
            ? 'bg-blue-500'
            : 'bg-orange-500'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>{t('syncing', { count: pendingCount })}</span>
              </>
            ) : (
              <span>{t('pending', { count: pendingCount })}</span>
            )}
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>{t('offlineMode')}</span>
          </>
        )}
      </div>
    </div>
  )
}
