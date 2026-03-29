// 图片压缩工具

interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeKB?: number
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  maxSizeKB: 1024, // 1MB
}

/**
 * 压缩图片文件
 * @param file 原始文件
 * @param options 压缩选项
 * @returns 压缩后的 Blob
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // 计算缩放比例
      let { width, height } = img
      if (width > opts.maxWidth!) {
        height = (height * opts.maxWidth!) / width
        width = opts.maxWidth!
      }
      if (height > opts.maxHeight!) {
        width = (width * opts.maxHeight!) / height
        height = opts.maxHeight!
      }

      canvas.width = width
      canvas.height = height

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 使用白色背景（避免透明变黑）
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      // 尝试按质量压缩
      let quality = opts.quality!
      const minQuality = 0.3
      const step = 0.1

      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }

            // 如果压缩后仍然太大且质量还可以降低，继续压缩
            if (blob.size > opts.maxSizeKB! * 1024 && quality > minQuality) {
              quality -= step
              tryCompress()
            } else {
              resolve(blob)
            }
          },
          'image/jpeg',
          quality
        )
      }

      tryCompress()
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

/**
 * 验证图片文件
 * @param file 要验证的文件
 * @param maxSizeMB 最大文件大小（MB）
 * @returns 验证结果
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `不支持的文件类型: ${file.type}。支持: JPG, PNG, GIF, WebP, PDF`,
    }
  }

  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `文件太大: ${(file.size / 1024 / 1024).toFixed(2)}MB。最大: ${maxSizeMB}MB`,
    }
  }

  return { valid: true }
}

/**
 * 创建缩略图
 * @param file 原始文件
 * @param size 缩略图大小
 * @returns 缩略图 Blob URL
 */
export async function createThumbnail(
  file: File,
  size: number = 150
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      canvas.width = size
      canvas.height = size

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 居中裁剪
      const minDim = Math.min(img.width, img.height)
      const sx = (img.width - minDim) / 2
      const sy = (img.height - minDim) / 2

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

// ==================== OCR 图像预处理 ====================

export interface OCRPreprocessOptions {
  targetSize?: number // 目标最大尺寸
  grayscale?: boolean
  contrast?: number // 1.0-2.0
  brightness?: number // 0.0-2.0
  deskew?: boolean // 自动纠偏
  crop?: boolean // 自动裁剪空白边缘
}

/**
 * OCR图像预处理 - 优化图片以提高识别率
 * @param imageSource 图片源（File 或 HTMLImageElement）
 * @param options 预处理选项
 * @returns 处理后的 Canvas
 */
export async function preprocessForOCR(
  imageSource: File | HTMLImageElement,
  options: OCRPreprocessOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    targetSize = 2500,
    grayscale = true,
    contrast = 1.3,
    brightness = 1.0,
  } = options

  return new Promise((resolve, reject) => {
    const img = imageSource instanceof HTMLImageElement
      ? imageSource
      : null

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }

    const loadAndProcess = (sourceImg: HTMLImageElement) => {
      let { width, height } = sourceImg

      // 缩放
      if (width > targetSize || height > targetSize) {
        if (width > height) {
          height = Math.round((height / width) * targetSize)
          width = targetSize
        } else {
          width = Math.round((width / height) * targetSize)
          height = targetSize
        }
      }

      canvas.width = width
      canvas.height = height

      // 白色背景
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)

      // 绘制图片
      ctx.drawImage(sourceImg, 0, 0, width, height)

      // 获取图像数据
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // 计算平均亮度用于自动亮度调整
      let avgBrightness = 0
      for (let i = 0; i < data.length; i += 4) {
        avgBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3
      }
      avgBrightness /= (data.length / 4)

      // 自动亮度校正
      const autoBrightness = brightness === 1.0 ? 1.2 - (avgBrightness / 255) : brightness

      // 处理每个像素
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i]
        let g = data[i + 1]
        let b = data[i + 2]

        if (grayscale) {
          // 转换为灰度并增强
          const gray = r * 0.299 + g * 0.587 + b * 0.114

          // 应用亮度和对比度
          const adjusted = ((gray / 255 - 0.5) * contrast + 0.5) * 255 * autoBrightness

          // 应用平滑的对比度曲线（更好的OCR效果）
          const enhanced = Math.pow(adjusted / 255, 0.9) * 255

          // 转为略带暖色的灰度（OCR优化）
          r = enhanced * 0.95
          g = enhanced
          b = enhanced * 0.85
        } else {
          // 彩色模式下的亮度和对比度调整
          r = Math.min(255, Math.max(0, ((r / 255 - 0.5) * contrast + 0.5) * 255 * autoBrightness))
          g = Math.min(255, Math.max(0, ((g / 255 - 0.5) * contrast + 0.5) * 255 * autoBrightness))
          b = Math.min(255, Math.max(0, ((b / 255 - 0.5) * contrast + 0.5) * 255 * autoBrightness))
        }

        data[i] = Math.min(255, Math.max(0, r))
        data[i + 1] = Math.min(255, Math.max(0, g))
        data[i + 2] = Math.min(255, Math.max(0, b))
      }

      ctx.putImageData(imageData, 0, 0)

      // 清理
      if (!(imageSource instanceof HTMLImageElement)) {
        URL.revokeObjectURL(sourceImg.src)
      }

      resolve(canvas)
    }

    if (imageSource instanceof File) {
      const tempImg = new Image()
      tempImg.onload = () => loadAndProcess(tempImg)
      tempImg.onerror = () => reject(new Error('Failed to load image'))
      tempImg.src = URL.createObjectURL(imageSource)
    } else if (img) {
      loadAndProcess(img)
    } else {
      reject(new Error('Invalid image source'))
    }
  })
}

/**
 * 检测图像是否需要预处理（用于判断光线、方向等）
 */
export async function analyzeImageQuality(file: File): Promise<{
  needsPreprocessing: boolean
  isGrayscale: boolean
  avgBrightness: number
  suggestions: string[]
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      canvas.width = 100
      canvas.height = 100
      ctx.drawImage(img, 0, 0, 100, 100)

      const imageData = ctx.getImageData(0, 0, 100, 100)
      const data = imageData.data

      let totalBrightness = 0
      let totalR = 0, totalG = 0, totalB = 0
      const sampleSize = data.length / 4

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        totalR += r
        totalG += g
        totalB += b
        totalBrightness += (r + g + b) / 3
      }

      const avgBrightness = totalBrightness / sampleSize
      const avgR = totalR / sampleSize
      const avgG = totalG / sampleSize
      const avgB = totalB / sampleSize

      // 检测是否为灰度图像
      const colorDiff = Math.abs(avgR - avgG) + Math.abs(avgG - avgB) + Math.abs(avgB - avgR)
      const isGrayscale = colorDiff < 30

      const suggestions: string[] = []
      if (avgBrightness < 80) suggestions.push('光线较暗，建议开启闪光灯')
      if (avgBrightness > 220) suggestions.push('光线过亮，可能影响识别')
      if (!isGrayscale) suggestions.push('建议使用灰度模式提高识别率')

      resolve({
        needsPreprocessing: avgBrightness < 100 || avgBrightness > 200 || !isGrayscale,
        isGrayscale,
        avgBrightness,
        suggestions,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}