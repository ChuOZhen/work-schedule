// 启动 electron-vite，并剔除会阻止 Electron 以桌面模式启动的环境变量
import { spawn } from 'node:child_process'

const mode = process.argv[2] ?? 'dev'
delete process.env.ELECTRON_RUN_AS_NODE

const args = mode === 'preview' ? ['electron-vite', 'preview'] : ['electron-vite', 'dev']

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env
})

child.on('exit', (code) => process.exit(code ?? 0))
