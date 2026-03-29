"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Camera, SwitchCamera, Loader2, Flashlight, FlashlightOff, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
  onError?: (error: string) => void
}

export function BarcodeScanner({ onScan, onClose, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [lowLight, setLowLight] = useState(false)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef<number>(0)
  const readerRef = useRef<any>(null)
  const mountedRef = useRef(true)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const t = useTranslations('scanner')
  const tCommon = useTranslations('common')

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }
    if (readerRef.current) {
      try {
        readerRef.current.reset()
      } catch (e) {
        // Ignore reset errors
      }
    }
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
    setTorchOn(false)
  }, [])

  // Toggle torch
  const toggleTorch = useCallback(() => {
    if (!streamRef.current) return

    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (!videoTrack) return

    const newTorchState = !torchOn
    if ('torch' in videoTrack.getCapabilities() as any) {
      videoTrack.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      } as MediaTrackConstraints)
      setTorchOn(newTorchState)
    }
  }, [torchOn])

  // Initialize scanner
  useEffect(() => {
    mountedRef.current = true

    const initScanner = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library')

        if (!mountedRef.current) return

        // Configure hints to prioritize common barcode formats
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)

        const codeReader = new BrowserMultiFormatReader(hints)
        readerRef.current = codeReader
        setIsInitialized(true)

        // Get available video devices
        let videoInputDevices: MediaDeviceInfo[] = []
        try {
          videoInputDevices = await codeReader.listVideoInputDevices()
        } catch (enumErr: any) {
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

    if (typeof window !== 'undefined') {
      initScanner()
    }

    return () => {
      mountedRef.current = false
      setIsInitialized(false)
      stopScanning()
    }
  }, [onError, stopScanning, t])

  // Check light levels periodically
  useEffect(() => {
    if (!isScanning || !videoRef.current) return

    const checkLight = () => {
      if (!videoRef.current || !isScanning) return

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = 10
      canvas.height = 10

      try {
        ctx.drawImage(videoRef.current, 0, 0, 10, 10)
        const data = ctx.getImageData(0, 0, 10, 10).data

        // Calculate average brightness
        let total = 0
        for (let i = 0; i < data.length; i += 4) {
          total += (data[i] + data[i+1] + data[i+2]) / 3
        }
        const avg = total / (data.length / 4)

        // Low light threshold
        setLowLight(avg < 50)
      } catch {
        // Ignore errors when checking light
      }
    }

    const lightInterval = setInterval(checkLight, 2000)
    return () => clearInterval(lightInterval)
  }, [isScanning])

  const startScanning = useCallback(async () => {
    if (!readerRef.current || !videoRef.current) return

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // Check if getUserMedia is available
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
      const videoConstraints: MediaStreamConstraints = selectedDeviceId
        ? {
            video: {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          }
        : {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          }

      // Get stream for torch control
      try {
        const stream = await navigator.mediaDevices.getUserMedia(videoConstraints)
        streamRef.current = stream

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

              // Visual feedback
              setScanSuccess(true)
              setTimeout(() => setScanSuccess(false), 500)

              // Vibrate on success
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(100)
              }

              onScan(code)

              // Auto-stop after successful scan
              scanTimeoutRef.current = setTimeout(() => {
                stopScanning()
              }, 1000)
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

      // Auto-stop after 3 minutes to save battery
      scanTimeoutRef.current = setTimeout(() => {
        stopScanning()
      }, 180000)

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
  }, [selectedDeviceId, onScan, onError, stopScanning, t])

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
        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {isScanning && 'torch' in (streamRef.current?.getVideoTracks()[0]?.getCapabilities?.() || {}) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTorch}
              className={`text-white hover:bg-white/20 ${torchOn ? 'bg-yellow-500/50' : ''}`}
              title={torchOn ? '关闭闪光灯' : '打开闪光灯'}
            >
              {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-6 w-6" />
          </Button>
        </div>
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

        {/* Low light warning */}
        {lowLight && isScanning && (
          <div className="absolute top-20 inset-x-0 text-center">
            <div className="inline-block bg-orange-500/80 text-white px-4 py-2 rounded-lg text-sm">
              <Flashlight className="inline h-4 w-4 mr-1" />
              光线较暗，点击上方闪光灯图标
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-64 h-40 rounded-lg relative transition-all duration-300 ${scanSuccess ? 'border-green-500' : 'border-white/50'}`}
                 style={{ borderWidth: scanSuccess ? '4px' : '2px' }}>
              {/* Corner markers */}
              <div className={`absolute top-0 left-0 w-8 h-8 ${scanSuccess ? 'border-green-500' : 'border-primary'} rounded-tl-lg`}
                   style={{ borderTopWidth: '4px', borderLeftWidth: '4px' }} />
              <div className={`absolute top-0 right-0 w-8 h-8 ${scanSuccess ? 'border-green-500' : 'border-primary'} rounded-tr-lg`}
                   style={{ borderTopWidth: '4px', borderRightWidth: '4px' }} />
              <div className={`absolute bottom-0 left-0 w-8 h-8 ${scanSuccess ? 'border-green-500' : 'border-primary'} rounded-bl-lg`}
                   style={{ borderBottomWidth: '4px', borderLeftWidth: '4px' }} />
              <div className={`absolute bottom-0 right-0 w-8 h-8 ${scanSuccess ? 'border-green-500' : 'border-primary'} rounded-br-lg`}
                   style={{ borderBottomWidth: '4px', borderRightWidth: '4px' }} />

              {/* Scanning line animation */}
              {!scanSuccess && (
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-primary animate-pulse" />
              )}

              {/* Success checkmark */}
              {scanSuccess && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500 animate-bounce" />
                </div>
              )}
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
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-red-400" />
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
        {isScanning && !errorMessage && (
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
