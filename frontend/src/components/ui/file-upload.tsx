"use client"

import { useCallback, useState } from 'react'
import { Upload, X, FileImage, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number // in bytes
  disabled?: boolean
  className?: string
}

export function FileUpload({
  onFileSelect,
  accept = 'image/*,.pdf',
  maxSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  className = '',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSize) {
      return `文件大小超出限制 (最大 ${Math.round(maxSize / 1024 / 1024)}MB)`
    }

    const acceptedTypes = accept.split(',').map(t => t.trim())
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'))
      }
      return file.type === type || file.name.endsWith(type.replace('.', ''))
    })

    if (!isValidType) {
      return '不支持的文件类型'
    }

    return null
  }, [accept, maxSize])

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSelectedFile(file)
    onFileSelect(file)
  }, [validateFile, onFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [disabled, handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const clearFile = useCallback(() => {
    setSelectedFile(null)
    setError(null)
  }, [])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <FileImage className="h-8 w-8 text-blue-500" />
    }
    return <FileText className="h-8 w-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className={className}>
      {!selectedFile ? (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            className="hidden"
          />
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            拖拽文件到此处或点击上传
          </p>
          <p className="text-xs text-muted-foreground">
            支持图片 (JPG, PNG, GIF, WebP) 和 PDF 文件，最大 {Math.round(maxSize / 1024 / 1024)}MB
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-4">
            {getFileIcon(selectedFile)}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFile}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}

// Loading overlay component for recognition
export function RecognitionLoading({ provider, model }: { provider?: string; model?: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-8 text-center max-w-sm">
        <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
        <p className="text-lg font-medium mb-2">AI 正在识别中...</p>
        <p className="text-sm text-muted-foreground">
          {provider && model ? `${provider} / ${model}` : '请稍候'}
        </p>
      </div>
    </div>
  )
}
