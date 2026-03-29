// Browser-side OCR using Tesseract.js

import Tesseract, { createWorker, PSM } from 'tesseract.js'
import type { Worker } from 'tesseract.js'

export interface OCRResult {
  text: string
  confidence: number
  items: OCRItem[]
}

export interface OCRItem {
  name?: string
  barcode?: string
  price?: number
  quantity?: number
  unit?: string
  confidence: number
}

export interface OCRProgress {
  status: 'loading' | 'recognizing' | 'parsing' | 'done' | 'error'
  progress: number
  message: string
}

type ProgressCallback = (progress: OCRProgress) => void

// Singleton worker pool
let worker: Worker | null = null
let initializing = false
let initPromise: Promise<Worker | null> | null = null

/**
 * Initialize Tesseract worker with Chinese + English support
 */
async function getWorker(progressCallback?: ProgressCallback): Promise<Worker | null> {
  if (worker) return worker
  if (initializing && initPromise) return initPromise

  initializing = true
  progressCallback?.({ status: 'loading', progress: 0, message: 'Loading OCR engine...' })

  initPromise = (async () => {
    try {
      const w = await createWorker(['eng', 'chi_sim'], 1, {
        logger: (m) => {
          if (m.status === 'loading tesseract core') {
            progressCallback?.({ status: 'loading', progress: m.progress * 30, message: 'Loading OCR core...' })
          } else if (m.status === 'initializing tesseract') {
            progressCallback?.({ status: 'loading', progress: 30 + m.progress * 20, message: 'Initializing...' })
          } else if (m.status === 'loading language traineddata') {
            progressCallback?.({ status: 'loading', progress: 50 + m.progress * 30, message: 'Loading language data...' })
          } else if (m.status === 'initializing api') {
            progressCallback?.({ status: 'loading', progress: 80 + m.progress * 10, message: 'Starting OCR...' })
          }
        },
      })
      await w.setParameters({
        preserve_interword_spaces: '0',
        tessedit_pageseg_mode: PSM.AUTO, // Fully automatic page segmentation
      })
      worker = w
      return w
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error)
      return null
    } finally {
      initializing = false
    }
  })()

  return initPromise
}

/**
 * Preprocess image for better OCR accuracy
 */
function preprocessImage(imageSource: HTMLImageElement | HTMLCanvasElement | File): Promise<{
  canvas: HTMLCanvasElement
  width: number
  height: number
}> {
  return new Promise((resolve, reject) => {
    const img = imageSource instanceof HTMLImageElement ? imageSource : null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }

    // Store ctx in a const that TypeScript knows is non-null for the closure
    const ctxNonNull = ctx

    // Create image if we have a File
    if (imageSource instanceof File) {
      const tempImg = new Image()
      tempImg.onload = () => processImage(tempImg)
      tempImg.onerror = () => reject(new Error('Failed to load image'))
      tempImg.src = URL.createObjectURL(imageSource)
    } else if (img) {
      processImage(img)
    } else {
      reject(new Error('Invalid image source'))
    }

    function processImage(sourceImg: HTMLImageElement) {
      // Target size for OCR (not too large for performance)
      const maxDim = 2000
      let { width, height } = sourceImg

      // Scale down if too large
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim
          width = maxDim
        } else {
          width = (width / height) * maxDim
          height = maxDim
        }
      }

      canvas.width = width
      canvas.height = height

      // Fill with white background
      ctxNonNull.fillStyle = '#FFFFFF'
      ctxNonNull.fillRect(0, 0, width, height)

      // Draw image
      ctxNonNull.drawImage(sourceImg, 0, 0, width, height)

      // Apply contrast enhancement
      const imageData = ctxNonNull.getImageData(0, 0, width, height)
      const data = imageData.data

      // Calculate histogram for auto-levels
      let min = 255, max = 0
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        if (gray < min) min = gray
        if (gray > max) max = gray
      }

      // Apply contrast stretch
      const range = max - min || 1
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        const stretched = ((gray - min) / range) * 255
        const newGray = Math.max(0, Math.min(255, stretched))

        // Convert to grayscale with slight warm tint for better OCR
        data[i] = newGray * 0.9     // R
        data[i + 1] = newGray        // G
        data[i + 2] = newGray * 0.8 // B
      }

      ctxNonNull.putImageData(imageData, 0, 0)

      // Clean up object URL if created
      if (imageSource instanceof File) {
        URL.revokeObjectURL(sourceImg.src)
      }

      resolve({ canvas, width, height })
    }
  })
}

/**
 * Perform OCR on an image file
 */
export async function recognizeFromImage(
  imageFile: File,
  progressCallback?: ProgressCallback
): Promise<OCRResult> {
  const workerInstance = await getWorker(progressCallback)
  if (!workerInstance) {
    throw new Error('Failed to initialize OCR engine')
  }

  progressCallback?.({ status: 'recognizing', progress: 90, message: 'Recognizing text...' })

  // Preprocess image
  const { canvas } = await preprocessImage(imageFile)

  // Perform OCR
  const result = await workerInstance.recognize(canvas)

  const text = result.data.text
  const confidence = result.data.confidence

  progressCallback?.({ status: 'parsing', progress: 95, message: 'Parsing results...' })

  // Parse extracted text
  const items = parseReceiptText(text, confidence)

  progressCallback?.({ status: 'done', progress: 100, message: 'Done' })

  return {
    text,
    confidence,
    items,
  }
}

/**
 * Parse receipt/product label text into structured items
 */
function parseReceiptText(text: string, baseConfidence: number): OCRItem[] {
  const items: OCRItem[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Pattern for prices (¥123.45, 123.45元, RMB123.45)
  const pricePattern = /[¥￥]?\s*(\d+\.?\d{0,2})\s*(?:元|块)?/gi
  // Pattern for quantity (x3, ×3, 3个, 3件)
  const qtyPattern = /[x×]?\s*(\d+)\s*(?:个|件|瓶|袋|箱|包)?/gi
  // Pattern for barcode (various formats)
  const barcodePattern = /(?:\d{4}[-\s]?){2,}\d|^1\d{12,13}|\d{8,13}/g

  let currentItem: OCRItem | null = null

  for (const line of lines) {
    // Try to extract barcode
    const barcodeMatches = line.match(barcodePattern)
    if (barcodeMatches && barcodeMatches[0].length >= 8) {
      if (currentItem) {
        items.push({ ...currentItem, confidence: baseConfidence })
      }
      currentItem = { barcode: barcodeMatches[0].replace(/[-\s]/g, ''), confidence: baseConfidence }
      continue
    }

    // Try to extract price
    const priceMatches = [...line.matchAll(pricePattern)]
    if (priceMatches.length > 0) {
      const price = parseFloat(priceMatches[priceMatches.length - 1][1])
      if (!isNaN(price) && price > 0 && price < 100000) {
        if (currentItem) {
          currentItem.price = price
        }
      }
    }

    // Try to extract quantity
    const qtyMatches = [...line.matchAll(qtyPattern)]
    if (qtyMatches.length > 0) {
      const qty = parseInt(qtyMatches[0][1], 10)
      if (!isNaN(qty) && qty > 0 && qty < 1000) {
        if (currentItem) {
          currentItem.quantity = qty
        }
      }
    }

    // If line has Chinese characters and no price/qty, treat as product name
    const hasChinese = /[\u4e00-\u9fa5]/.test(line)
    const hasNumbers = /\d/.test(line)
    if (hasChinese && !hasNumbers && line.length >= 2 && line.length <= 50) {
      if (currentItem) {
        items.push({ ...currentItem, confidence: baseConfidence })
      }
      currentItem = { name: line, confidence: baseConfidence }
    }
  }

  // Don't forget the last item
  if (currentItem) {
    items.push({ ...currentItem, confidence: baseConfidence })
  }

  // Deduplicate
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.name || item.barcode
    if (!key) return false
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Check if browser OCR is available (all required APIs supported)
 */
export function isBrowserOCRAvailable(): boolean {
  if (typeof window === 'undefined') return false

  const hasWorkerSupport = typeof Worker !== 'undefined'
  const hasCanvasSupport = typeof document !== 'undefined' && document.createElement('canvas') !== null
  const hasFileSupport = typeof File !== 'undefined'

  return hasWorkerSupport && hasCanvasSupport && hasFileSupport
}

/**
 * Get OCR engine info
 */
export async function getOCRInfo(): Promise<{
  available: boolean
  languages: string[]
  version: string
}> {
  const available = isBrowserOCRAvailable()
  if (!available) {
    return { available: false, languages: [], version: '' }
  }

  try {
    const worker = await getWorker()
    return {
      available: true,
      languages: ['eng', 'chi_sim'],
      version: '5.x',
    }
  } catch {
    return { available: false, languages: [], version: '' }
  }
}

/**
 * Terminate OCR worker to free memory
 */
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
    initPromise = null
  }
}
