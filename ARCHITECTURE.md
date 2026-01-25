# Vibework 项目架构文档

## 项目概述

**Vibework** 是一个基于 Electron + React + TypeScript 的跨平台桌面应用模板项目。该项目采用现代化的技术栈和工具链，提供了一个开箱即用的桌面应用开发基础框架。

- **项目类型**: 跨平台桌面应用
- **核心框架**: Electron 39.2.6
- **UI 框架**: React 19.2.1
- **开发语言**: TypeScript 5.9.3
- **构建工具**: Vite 7.2.6 + electron-vite 5.0.0
- **包管理器**: pnpm

## 核心架构

### 三进程架构模型

Vibework 遵循 Electron 标准的多进程架构，将应用分为三个独立的层次：

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐         ┌──────────────────┐       │
│  │  Main Process  │◄────────┤  Preload Script  │       │
│  │   (Node.js)    │         │  (安全桥接层)      │       │
│  └────────────────┘         └──────────────────┘       │
│         │                            │                  │
│         │                            ▼                  │
│         │                   ┌──────────────────┐       │
│         └──────────────────►│ Renderer Process │       │
│                              │   (React UI)     │       │
│                              └──────────────────┘       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 1. Main Process (主进程)

**位置**: `src/main/index.ts`

**职责**:
- 应用生命周期管理
- 窗口创建和管理
- 系统原生 API 调用
- IPC 通信处理
- 自动更新管理

**核心功能**:
```typescript
// 窗口创建
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
}

// IPC 通信示例
ipcMain.on('ping', () => console.log('pong'))
```

**平台特性处理**:
- macOS: 支持 Dock 图标点击重新创建窗口
- Windows/Linux: 所有窗口关闭时退出应用
- 外部链接自动在系统浏览器中打开

#### 2. Preload Script (预加载脚本)

**位置**: `src/preload/index.ts`, `src/preload/index.d.ts`

**职责**:
- 作为主进程和渲染进程之间的安全桥梁
- 通过 `contextBridge` 暴露安全的 API
- 提供类型安全的接口定义

**安全机制**:
```typescript
// 使用 contextBridge 安全地暴露 API
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', {
  // 自定义 API
})
```

**类型定义**:
```typescript
// index.d.ts 提供全局类型声明
declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
  }
}
```

#### 3. Renderer Process (渲染进程)

**位置**: `src/renderer/`

**职责**:
- 用户界面渲染
- 用户交互处理
- 通过 IPC 与主进程通信

**技术栈**:
- React 19.2.1 (最新版本)
- TypeScript
- CSS Modules
- Vite HMR (热模块替换)

**入口点**:
```typescript
// src/renderer/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

## 目录结构

```
vibework/
├── .vscode/                      # VSCode 配置
│   ├── launch.json              # 调试配置 (Main + Renderer)
│   ├── settings.json            # 编辑器设置
│   └── extensions.json          # 推荐扩展
│
├── build/                        # 构建资源
│   ├── icon.icns               # macOS 图标
│   ├── icon.ico                # Windows 图标
│   ├── icon.png                # Linux 图标
│   └── entitlements.mac.plist  # macOS 权限配置
│
├── resources/                    # 应用资源
│   └── icon.png                # 应用图标
│
├── src/                          # 源代码
│   ├── main/                    # 主进程代码
│   │   └── index.ts            # 主进程入口
│   │
│   ├── preload/                 # 预加载脚本
│   │   ├── index.ts            # 预加载脚本实现
│   │   └── index.d.ts          # 类型定义
│   │
│   └── renderer/                # 渲染进程代码
│       ├── index.html          # HTML 模板
│       └── src/
│           ├── main.tsx        # React 入口
│           ├── App.tsx         # 根组件
│           ├── env.d.ts        # 环境类型定义
│           ├── components/     # React 组件
│           │   └── Versions.tsx
│           └── assets/         # 静态资源
│               ├── main.css
│               ├── base.css
│               ├── electron.svg
│               └── wavy-lines.svg
│
├── out/                          # 构建输出目录
│   ├── main/                    # 主进程构建产物
│   ├── preload/                 # 预加载脚本构建产物
│   └── renderer/                # 渲染进程构建产物
│
├── dist/                         # 打包输出目录
│   ├── win-unpacked/           # Windows 未打包版本
│   ├── mac/                    # macOS 应用
│   └── linux-unpacked/         # Linux 未打包版本
│
├── package.json                  # 项目配置
├── electron.vite.config.ts      # Vite 构建配置
├── electron-builder.yml         # Electron Builder 配置
├── tsconfig.json                # TypeScript 根配置
├── tsconfig.node.json           # Node 环境 TS 配置
├── tsconfig.web.json            # Web 环境 TS 配置
├── eslint.config.mjs            # ESLint 配置
└── .prettierrc.yaml             # Prettier 配置
```

## 技术栈详解

### 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| electron | 39.2.6 | 桌面应用框架 |
| react | 19.2.1 | UI 框架 |
| react-dom | 19.2.1 | React DOM 渲染 |
| typescript | 5.9.3 | 类型安全 |
| vite | 7.2.6 | 构建工具 |
| electron-vite | 5.0.0 | Electron 专用 Vite 配置 |
| electron-builder | 26.0.12 | 应用打包工具 |
| electron-updater | 6.3.9 | 自动更新功能 |

### 工具链

| 工具 | 用途 |
|------|------|
| @electron-toolkit/utils | Electron 工具函数 |
| @electron-toolkit/preload | 预加载脚本工具 |
| @vitejs/plugin-react | React 支持 |
| ESLint 9 | 代码检查 |
| Prettier 3.7.4 | 代码格式化 |
| pnpm | 包管理器 |

## 构建配置

### Vite 配置 (electron.vite.config.ts)

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
```

**配置说明**:
- **main**: 主进程构建配置，外部化依赖
- **preload**: 预加载脚本构建配置
- **renderer**: 渲染进程配置，支持 React 和路径别名

### TypeScript 配置

采用 **Project References** 模式，分离不同环境的配置：

**tsconfig.json** (根配置):
```json
{
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

**tsconfig.node.json** (Node 环境):
- 适用于: Main Process + Preload Script
- 目标: ES2022
- 模块: ESNext

**tsconfig.web.json** (Web 环境):
- 适用于: Renderer Process
- 目标: ES2020
- 库: DOM, DOM.Iterable

### Electron Builder 配置 (electron-builder.yml)

```yaml
appId: com.electron.app
productName: vibework
directories:
  buildResources: build
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
asarUnpack:
  - resources/**
win:
  executableName: vibework
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
mac:
  entitlementsInherit: build/entitlements.mac.plist
  extendInfo:
    - NSCameraUsageDescription: Application requests access to the device's camera.
    - NSMicrophoneUsageDescription: Application requests access to the device's microphone.
    - NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.
    - NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.
  notarize: false
dmg:
  artifactName: ${name}-${version}.${ext}
linux:
  target:
    - AppImage
    - snap
    - deb
  maintainer: electronjs.org
  category: Utility
appImage:
  artifactName: ${name}-${version}.${ext}
npmRebuild: false
publish:
  provider: generic
  url: https://example.com/auto-updates
```

**多平台支持**:
- **Windows**: NSIS 安装程序
- **macOS**: DMG 镜像 + 权限配置
- **Linux**: AppImage, Snap, Deb 包

## 应用启动流程

```
1. 用户启动应用
   ↓
2. Electron 初始化
   ↓
3. app.whenReady() 触发
   ↓
4. 设置 App User Model ID (Windows)
   ↓
5. 注册窗口快捷键监听 (F12 开发者工具)
   ↓
6. 注册 IPC 处理器 (ipcMain.on('ping'))
   ↓
7. createWindow() 创建主窗口
   ├─ 创建 BrowserWindow (900x670)
   ├─ 配置 webPreferences (preload 脚本)
   ├─ 监听 'ready-to-show' 事件
   └─ 设置外部链接处理器
   ↓
8. 加载 Preload Script
   ├─ 执行 src/preload/index.ts
   ├─ 通过 contextBridge 暴露 API
   └─ 完成安全桥接
   ↓
9. 加载 Renderer Process
   ├─ 开发环境: 加载 Vite Dev Server URL
   └─ 生产环境: 加载本地 HTML 文件
   ↓
10. 渲染进程初始化
    ├─ 解析 index.html
    ├─ 执行 main.tsx
    ├─ 创建 React Root
    └─ 渲染 <App /> 组件
    ↓
11. 应用就绪，显示窗口
```

## IPC 通信机制

### 通信模式

```
Renderer Process          Preload Script          Main Process
     │                          │                       │
     │  window.electron         │                       │
     │  .ipcRenderer.send()     │                       │
     ├─────────────────────────►│                       │
     │                          │  ipcRenderer.send()   │
     │                          ├──────────────────────►│
     │                          │                       │
     │                          │                       │ ipcMain.on()
     │                          │                       │ 处理事件
     │                          │                       │
     │                          │  event.reply()        │
     │                          │◄──────────────────────┤
     │  callback()              │                       │
     │◄─────────────────────────┤                       │
     │                          │                       │
```

### 示例代码

**Renderer (发送消息)**:
```typescript
// src/renderer/src/App.tsx
const ipcHandle = () => window.electron.ipcRenderer.send('ping')
```

**Main (接收消息)**:
```typescript
// src/main/index.ts
ipcMain.on('ping', () => console.log('pong'))
```

**Preload (安全桥接)**:
```typescript
// src/preload/index.ts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('electron', electronAPI)
```

## 开发工作流

### 可用脚本

```bash
# 开发模式 (带热重载)
pnpm dev

# 类型检查
pnpm typecheck          # 检查所有
pnpm typecheck:node     # 检查 Main + Preload
pnpm typecheck:web      # 检查 Renderer

# 代码质量
pnpm lint               # ESLint 检查
pnpm format             # Prettier 格式化

# 构建
pnpm build              # 类型检查 + 构建所有进程

# 打包
pnpm build:win          # Windows 安装程序
pnpm build:mac          # macOS DMG
pnpm build:linux        # Linux 包 (AppImage/Snap/Deb)
pnpm build:unpack       # 构建但不打包

# 预览
pnpm start              # 预览生产构建
```

### 开发环境特性

1. **热模块替换 (HMR)**
   - Renderer 进程支持 React Fast Refresh
   - 代码修改后自动刷新，保持状态

2. **开发者工具**
   - F12 打开 Chrome DevTools
   - 支持 React DevTools 扩展

3. **调试配置**
   - VSCode 调试配置已预设
   - 支持同时调试 Main 和 Renderer 进程

### 调试配置 (.vscode/launch.json)

```json
{
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceRoot}",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron-vite",
      "runtimeArgs": ["--sourcemap"]
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src/renderer",
      "timeout": 30000
    }
  ],
  "compounds": [
    {
      "name": "Debug All",
      "configurations": ["Debug Main Process", "Debug Renderer Process"]
    }
  ]
}
```

## 安全机制

### 1. Context Isolation (上下文隔离)

默认启用，确保渲染进程无法直接访问 Node.js API：

```typescript
webPreferences: {
  contextIsolation: true,  // 默认值
  sandbox: false
}
```

### 2. Content Security Policy (CSP)

在 `index.html` 中定义：

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
/>
```

### 3. 外部链接处理

防止在应用内打开不受信任的网页：

```typescript
mainWindow.webContents.setWindowOpenHandler((details) => {
  shell.openExternal(details.url)  // 在系统浏览器中打开
  return { action: 'deny' }        // 拒绝在应用内打开
})
```

### 4. Preload Script 安全桥接

使用 `contextBridge` 而非直接暴露 Node.js API：

```typescript
// ✅ 安全方式
contextBridge.exposeInMainWorld('api', {
  safeFunction: () => { /* ... */ }
})

// ❌ 不安全方式
window.require = require  // 永远不要这样做
```

## 扩展指南

### 添加新的 IPC 通信

**1. 在 Main Process 中注册处理器**:
```typescript
// src/main/index.ts
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})
```

**2. 在 Preload 中暴露 API**:
```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
})
```

**3. 在 Renderer 中调用**:
```typescript
// src/renderer/src/App.tsx
const version = await window.api.getAppVersion()
```

### 添加新的 React 组件

```typescript
// src/renderer/src/components/MyComponent.tsx
import React from 'react'

export const MyComponent: React.FC = () => {
  return <div>My Component</div>
}
```

### 集成第三方库

**Renderer 进程** (UI 库):
```bash
pnpm add antd  # 或其他 React UI 库
```

**Main 进程** (Node.js 库):
```bash
pnpm add fs-extra
```

### 添加路由

```bash
pnpm add react-router-dom
```

```typescript
// src/renderer/src/App.tsx
import { HashRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </HashRouter>
  )
}
```

### 添加状态管理

```bash
pnpm add zustand  # 或 redux, mobx 等
```

### 添加数据持久化

**方案 1: electron-store**
```bash
pnpm add electron-store
```

**方案 2: SQLite**
```bash
pnpm add better-sqlite3
```

**方案 3: IndexedDB** (Renderer 进程)
```bash
pnpm add dexie  # IndexedDB 封装库
```

## 构建和发布

### 本地构建

```bash
# 构建当前平台
pnpm build

# 构建特定平台
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

### 构建产物

```
dist/
├── win-unpacked/              # Windows 未打包版本
├── vibework-1.0.0-setup.exe   # Windows 安装程序
├── mac/                       # macOS 应用
├── vibework-1.0.0.dmg         # macOS 镜像
├── vibework-1.0.0.AppImage    # Linux AppImage
├── vibework_1.0.0_amd64.deb   # Debian 包
└── vibework_1.0.0_amd64.snap  # Snap 包
```

### 自动更新配置

在 `electron-builder.yml` 中配置：

```yaml
publish:
  provider: generic
  url: https://your-update-server.com/updates
```

在代码中使用：

```typescript
// src/main/index.ts
import { autoUpdater } from 'electron-updater'

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify()
})
```

### 代码签名

**macOS**:
```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your-password
pnpm build:mac
```

**Windows**:
```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your-password
pnpm build:win
```

## 性能优化建议

### 1. 减小包体积

- 使用 `asar` 打包 (默认启用)
- 排除不必要的文件 (在 `electron-builder.yml` 中配置)
- 使用 `externalizeDepsPlugin` 外部化依赖

### 2. 加快启动速度

- 延迟加载非关键模块
- 使用 `v8-compile-cache` 缓存编译结果
- 优化 Preload 脚本大小

### 3. 优化渲染性能

- 使用 React.memo 避免不必要的重渲染
- 使用 Code Splitting 分割代码
- 启用 Vite 的构建优化

### 4. 内存优化

- 及时清理事件监听器
- 避免内存泄漏 (使用 Chrome DevTools 分析)
- 合理使用 `webContents.destroy()`

## 常见问题

### Q: 如何在生产环境中打开 DevTools？

```typescript
// src/main/index.ts
if (process.env.DEBUG_PROD === 'true') {
  mainWindow.webContents.openDevTools()
}
```

### Q: 如何处理应用崩溃？

```typescript
// src/main/index.ts
import { crashReporter } from 'electron'

crashReporter.start({
  productName: 'Vibework',
  companyName: 'Your Company',
  submitURL: 'https://your-crash-server.com/submit',
  uploadToServer: true
})
```

### Q: 如何实现多窗口？

```typescript
// src/main/index.ts
function createSecondWindow() {
  const secondWindow = new BrowserWindow({
    width: 600,
    height: 400,
    parent: mainWindow,  // 设置父窗口
    modal: true          // 模态窗口
  })

  secondWindow.loadFile(join(__dirname, '../renderer/second.html'))
}
```

### Q: 如何访问系统托盘？

```typescript
// src/main/index.ts
import { Tray, Menu } from 'electron'

let tray: Tray | null = null

app.whenReady().then(() => {
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(contextMenu)
})
```

## 推荐资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-vite 文档](https://electron-vite.org/)
- [Electron Builder 文档](https://www.electron.build/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)

## 项目特点总结

✅ **现代化技术栈**: React 19 + TypeScript 5.9 + Vite 7
✅ **类型安全**: 完整的 TypeScript 类型定义
✅ **开发体验**: HMR + 调试配置 + ESLint + Prettier
✅ **安全机制**: Context Isolation + CSP + 安全的 IPC 通信
✅ **跨平台支持**: Windows + macOS + Linux
✅ **自动更新**: 内置 electron-updater
✅ **可扩展性**: 清晰的架构，易于添加新功能
✅ **生产就绪**: 完整的构建和打包配置

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-25
