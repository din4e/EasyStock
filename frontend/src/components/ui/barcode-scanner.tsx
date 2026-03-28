"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Camera, SwitchCamera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
  onError?: (error: string) => void
}

export function BarcodeScanner({ onScan, onClose, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef<number>(0)
  const readerRef = useRef<any>(null)
  const mountedRef = useRef(true)
  const t = useTranslations('scanner')
  const tCommon = useTranslations('common')

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset()
      } catch (e) {
        // Ignore reset errors
      }
    }
    setIsScanning(false)
  }, [])

  // Initialize scanner
  useEffect(() => {
    mountedRef.current = true

    const initScanner = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { BrowserMultiFormatReader } = await import('@zxing/library')

        if (!mountedRef.current) return

        const codeReader = new BrowserMultiFormatReader()
        readerRef.current = codeReader
        setIsInitialized(true)

        // Get available video devices
        let videoInputDevices: MediaDeviceInfo[] = []
        try {
          videoInputDevices = await codeReader.listVideoInputDevices()
        } catch (enumErr: any) {
          // Browser may not support device enumeration (e.g., insecure context, some mobile browsers)
          // Fall through and try to use camera without device selection
          console.warn('Cannot enumerate video devices:', enumErr.message)
        }

        if (!mountedRef.current) return

        setDevices(videoInputDevices)

        if (videoInputDevices.length > 0) {
          // Prefer back camera on mobile
          const backCamera = videoInputDevices.find(
            (device: MediaDeviceInfo) =>
              device.label.toLowerCase().includes('back') ||
              device.label.toLowerCase().includes('rear') ||
              device.label.toLowerCase().includes('后') ||
              device.label.toLowerCase().includes('environment')
          )
          setSelectedDeviceId(backCamera?.deviceId || videoInputDevices[0].deviceId)
        } else if (!videoInputDevices.length) {
          // No devices found (or enumeration not supported) - try to scan with default camera
          setSelectedDeviceId('')
          setIsLoading(false)
        } else {
          setIsLoading(false)
          setErrorMessage(t('noCamera'))
        }
      } catch (err: any) {
        if (!mountedRef.current) return
        console.error('Failed to initialize scanner:', err)
        setIsLoading(false)
        const msg = t('initFailed') + ': ' + (err.message || String(err))
        setErrorMessage(msg)
        onError?.(msg)
      }
    }

    // Only run on client
    if (typeof window !== 'undefined') {
      initScanner()
    }

    return () => {
      mountedRef.current = false
      setIsInitialized(false)
      stopScanning()
    }
  }, [onError, stopScanning, t])

  const startScanning = useCallback(async () => {
    if (!readerRef.current || !videoRef.current) return

    // Check if getUserMedia is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsScanning(false)
      setIsLoading(false)
      const msg = t('notSupported')
      setErrorMessage(msg)
      onError?.(msg)
      return
    }

    setIsScanning(true)
    setHasPermission(null)

    try {
      // On mobile, explicitly request the back camera via getUserMedia first
      // to ensure proper permission and facingMode
      const videoConstraints: MediaStreamConstraints = selectedDeviceId
        ? { video: { deviceId: { exact: selectedDeviceId } } }
        : { video: { facingMode: 'environment' }, audio: false }

      // Get the stream first to ensure camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia(videoConstraints)
        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (permErr: any) {
        if (permErr.name === 'NotAllowedError') {
          setHasPermission(false)
          setIsScanning(false)
          setIsLoading(false)
          onError?.(t('permissionDenied'))
          return
        }
        // Fall through - maybe decodeFromVideoDevice can handle it
        console.warn('getUserMedia failed, trying decodeFromVideoDevice:', permErr)
      }

      // Start decoding
      readerRef.current.decodeFromVideoDevice(
        selectedDeviceId || null,
        videoRef.current,
        (result: any, error: any) => {
          if (result) {
            const code = result.getText()
            const now = Date.now()
            // Prevent duplicate scans within 2 seconds
            if (code !== lastScannedRef.current || now - lastScannedTimeRef.current > 2000) {
              lastScannedRef.current = code
              lastScannedTimeRef.current = now
              onScan(code)
              // Vibrate on success (if supported)
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(100)
              }
            }
          }
          // Ignore NotFoundException which is thrown when no barcode is found
          if (error && !error.message?.includes('No code found')) {
            console.warn('Scan error:', error)
          }
        }
      )
      setHasPermission(true)
      setIsLoading(false)
    } catch (err: any) {
      console.error('Failed to start scanner:', err)
      setIsScanning(false)
      setIsLoading(false)
      if (err.name === 'NotAllowedError') {
        setHasPermission(false)
        onError?.(t('permissionDenied'))
      } else {
        onError?.(t('startFailed') + ': ' + err.message)
      }
    }
  }, [selectedDeviceId, onScan, onError, t])

  // Start scanning once scanner is initialized
  useEffect(() => {
    if (isInitialized && !isScanning && mountedRef.current) {
      startScanning()
    }
  }, [isInitialized, isScanning, startScanning])

  const switchCamera = () => {
    if (devices.length <= 1) return

    stopScanning()
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    setSelectedDeviceId(devices[nextIndex].deviceId)
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 text-white">
        <h2 className="text-lg font-medium">{t('title')}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Video container */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-2 border-white/50 rounded-lg relative">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

              {/* Scanning line animation */}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-primary animate-pulse" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
              <p>{t('startingCamera')}</p>
            </div>
          </div>
        )}

        {/* Permission denied */}
        {hasPermission === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="text-center text-white max-w-sm">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t('needPermission')}</p>
              <p className="text-sm text-gray-400 mb-4">
                {t('permissionHelp')}
              </p>
              <Button variant="outline" onClick={onClose}>
                {tCommon('close')}
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="text-center text-white max-w-sm">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t('cannotStart')}</p>
              <p className="text-sm text-gray-400 mb-4">{errorMessage}</p>
              {errorMessage.includes(t('noCamera')) && (
                <p className="text-xs text-gray-500 mb-4">
                  {t('cameraTip')}
                </p>
              )}
              <Button variant="outline" onClick={onClose}>
                {tCommon('close')}
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {isScanning && (
          <div className="absolute bottom-20 inset-x-0 text-center text-white text-sm px-4">
            <p className="bg-black/50 inline-block px-4 py-2 rounded-lg">
              {t('instruction')}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 p-6 bg-black/50">
        {devices.length > 1 && (
          <Button
            variant="outline"
            size="icon"
            onClick={switchCamera}
            className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
            title={t('switchCamera')}
          >
            <SwitchCamera className="h-6 w-6" />
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onClose}
          className="px-8 bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          {tCommon('cancel')}
        </Button>
      </div>
    </div>
  )
}
