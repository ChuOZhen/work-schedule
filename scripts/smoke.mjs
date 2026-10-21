// 直接以桌面模式启动 Electron 跑数据层冒烟测试（使用临时数据目录）
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronPath = require('electron')

delete process.env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, WS_SMOKE: '1' }
})

child.on('exit', (code) => process.exit(code ?? 0))
