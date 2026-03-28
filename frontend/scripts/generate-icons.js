// 生成 PWA 图标的简单脚本
// 使用方法: node scripts/generate-icons.js

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const sizes = [192, 512]
const outputDir = path.join(__dirname, '../public/icons')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

sizes.forEach((size) => {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // 背景圆角矩形
  const radius = size * 0.2
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, radius)
  ctx.fill()

  // 包裹图标（简化版）
  const padding = size * 0.25
  const boxSize = size - padding * 2

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.04

  // 箱子主体
  const boxTop = padding + boxSize * 0.3
  const boxBottom = padding + boxSize
  ctx.beginPath()
  ctx.rect(padding, boxTop, boxSize, boxBottom - boxTop)
  ctx.stroke()

  // 箱子顶部
  ctx.beginPath()
  ctx.moveTo(padding, boxTop)
  ctx.lineTo(padding + boxSize, boxTop)
  ctx.stroke()

  // 箱子盖
  ctx.beginPath()
  ctx.rect(padding + boxSize * 0.1, padding, boxSize * 0.8, boxSize * 0.2)
  ctx.stroke()

  // 中线
  ctx.beginPath()
  ctx.moveTo(size / 2, boxTop)
  ctx.lineTo(size / 2, boxBottom)
  ctx.stroke()

  const filename = `icon-${size}x${size}.png`
  const filepath = path.join(outputDir, filename)
  fs.writeFileSync(filepath, canvas.toBuffer('image/png'))
  console.log(`Generated: ${filename}`)
})

console.log('Done!')
