// 生成应用图标与托盘图标（纯 Node，无需图形库）
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function roundRectAlpha(x, y, w, h, r) {
  // 返回 (x,y) 在圆角矩形内的覆盖率 0..1（简单抗锯齿）
  const cx = Math.min(Math.max(x, r), w - r)
  const cy = Math.min(Math.max(y, r), h - r)
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  return Math.min(1, Math.max(0, r - dist + 0.5))
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4, 0)
  const radius = size * 0.225
  const pad = size * 0.02
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - pad
      const py = y + 0.5 - pad
      const w = size - pad * 2
      const a = roundRectAlpha(px, py, w, w, radius)
      if (a <= 0) continue
      const t = y / size
      // 蓝色 → 靛蓝渐变，贴近 Apple 图标质感
      const r = lerp(10, 84, t)
      const g = lerp(132, 92, t)
      const b = lerp(255, 235, t)
      const i = (y * size + x) * 4
      buf[i] = Math.round(r)
      buf[i + 1] = Math.round(g)
      buf[i + 2] = Math.round(b)
      buf[i + 3] = Math.round(255 * a)
    }
  }

  // 白色日历字形
  const bw = size * 0.52
  const bh = size * 0.46
  const bx = (size - bw) / 2
  const by = (size - bh) / 2 + size * 0.04
  const rr = size * 0.075
  const bodyAlpha = 0.95
  const headerH = bh * 0.26

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const cover = roundRectAlpha(px - bx, py - by, bw, bh, rr)
      if (cover <= 0) continue
      const i = (y * size + x) * 4
      const isHeader = py - by < headerH
      // 表头用更实的白，主体用半透明白
      const alpha = (isHeader ? 1 : bodyAlpha) * cover
      const mix = (v) => Math.round(lerp(buf[i + 0], 255, alpha))
      buf[i] = mix(buf[i])
      buf[i + 1] = Math.round(lerp(buf[i + 1], 255, alpha))
      buf[i + 2] = Math.round(lerp(buf[i + 2], 255, alpha))
      buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * (0.55 + 0.45 * alpha)))
    }
  }

  // 三个"日期点"
  const dots = [
    [0.34, 0.62],
    [0.5, 0.62],
    [0.66, 0.62],
    [0.34, 0.78],
    [0.5, 0.78]
  ]
  const dotR = size * 0.035
  for (const [dx, dy] of dots) {
    const cx = bx + bw * dx
    const cy = by + bh * dy
    for (let y = Math.floor(cy - dotR * 2); y < cy + dotR * 2; y++) {
      for (let x = Math.floor(cx - dotR * 2); x < cx + dotR * 2; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        const a = Math.min(1, Math.max(0, dotR - d + 0.5))
        if (a <= 0) continue
        const i = (y * size + x) * 4
        // 点用蓝紫色，落在白色块上
        buf[i] = Math.round(lerp(buf[i], 88, a))
        buf[i + 1] = Math.round(lerp(buf[i + 1], 86, a))
        buf[i + 2] = Math.round(lerp(buf[i + 2], 214, a))
      }
    }
  }

  // 顶部两个"吊环"
  const stemW = size * 0.05
  const stemH = size * 0.1
  for (const sx of [bx + bw * 0.28, bx + bw * 0.72]) {
    for (let y = Math.floor(by - stemH); y < by + headerH * 0.5; y++) {
      for (let x = Math.floor(sx - stemW); x < sx + stemW; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const a = roundRectAlpha(x + 0.5 - (sx - stemW / 2), y + 0.5 - (by - stemH), stemW, stemH + headerH * 0.5, stemW / 2)
        if (a <= 0) continue
        const i = (y * size + x) * 4
        buf[i] = Math.round(lerp(buf[i], 255, a))
        buf[i + 1] = Math.round(lerp(buf[i + 1], 255, a))
        buf[i + 2] = Math.round(lerp(buf[i + 2], 255, a))
      }
    }
  }

  return encodePNG(size, size, buf)
}

const root = join(process.cwd(), 'resources')
mkdirSync(root, { recursive: true })
writeFileSync(join(root, 'tray.png'), drawIcon(32))
writeFileSync(join(root, 'icon.png'), drawIcon(256))
console.log('icons written to ' + root)
