"use client"

import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

/**
 * 离线状态指示器
 * 显示在布局底部，提示当前网络状态和待同步操作数
 */
export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync()

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
                <span>正在同步 {pendingCount} 条离线操作...</span>
              </>
            ) : (
              <span>{pendingCount} 条操作待同步</span>
            )}
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>离线模式 - 操作将在恢复连接后自动同步</span>
          </>
        )}
      </div>
    </div>
  )
}
