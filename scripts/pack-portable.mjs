// 组装便携版：Electron 运行时 + resources/app，产物 release/portable
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const releaseDir = join(root, 'release')
const outDir = join(releaseDir, 'portable')
const pkg = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(join(root, 'package.json'), 'utf8')))

console.log('› 构建渲染层与主进程…')
const build = spawnSync('npx', ['electron-vite', 'build'], { cwd: root, stdio: 'inherit', shell: true })
if (build.status !== 0) process.exit(build.status ?? 1)

console.log('› 清理旧产物…')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const electronDist = join(root, 'node_modules', 'electron', 'dist')
if (!existsSync(electronDist)) {
  console.error('找不到 node_modules/electron/dist，请先执行 npm install')
  process.exit(1)
}

console.log('› 复制 Electron 运行时…')
cpSync(electronDist, outDir, { recursive: true })

console.log('› 写入 resources/app…')
const appDir = join(outDir, 'resources', 'app')
mkdirSync(appDir, { recursive: true })
writeFileSync(
  join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      productName: 'work schedule',
      version: pkg.version,
      description: pkg.description,
      main: 'out/main/index.js'
    },
    null,
    2
  )
)
cpSync(join(root, 'out'), join(appDir, 'out'), { recursive: true })
cpSync(join(root, 'resources'), join(appDir, 'resources'), { recursive: true })

const exe = join(outDir, 'electron.exe')
if (existsSync(exe)) renameSync(exe, join(outDir, 'work schedule.exe'))

console.log('✓ 便携版已生成：' + outDir)
console.log('  双击 "work schedule.exe" 即可运行（免安装）')
