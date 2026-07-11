# 卷轴 Scroll — 开发日志

> 记录每次开发的变更内容，方便回溯。

---

## 2026-07-11 — 项目初始化

### 创建的文件

**项目配置 (9 个文件):**
- `package.json` — 项目配置、依赖声明、脚本
- `electron.vite.config.ts` — Electron + Vite 构建配置
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` — TypeScript 配置
- `tailwind.config.ts` — Tailwind CSS 主题配置（卷轴品牌色 + 阅读字体）
- `postcss.config.js` — PostCSS 配置
- `.gitignore` — Git 忽略规则（重点保护 API Key 和隐私数据）
- `.env.example` — 环境变量示例（安全提交到 Git）

**Electron 主进程 & 预加载 (3 个文件):**
- `src/main/index.ts` — 窗口管理、IPC 处理器（电子书对话框、音乐对话框、AI 代理）
- `src/preload/index.ts` — contextBridge 安全 API 暴露
- `src/renderer/src/env.d.ts` — TypeScript 全局类型声明

**React 渲染进程 (15 个文件):**
- `src/renderer/index.html` — HTML 入口
- `src/renderer/src/main.tsx` — React 入口
- `src/renderer/src/App.tsx` — 根组件（视图路由、键盘快捷键）
- `src/renderer/src/globals.css` — 全局样式 + Tailwind + 阅读器组件样式

- **布局组件 (6 个):**
  - `AppShell.tsx` — 主框架（顶栏 + 内容 + 侧边栏 + 音乐播放器）
  - `TopBar.tsx` — 顶栏导航（书架返回、侧边栏切换、音乐、主题、设置）
  - `Sidebar.tsx` — 侧边栏容器（目录/书签/AI）
  - `TocPanel.tsx` — 目录面板（骨架占位）
  - `BookmarkPanel.tsx` — 书签面板（骨架占位）
  - `SettingsDialog.tsx` — 设置对话框（AI 配置 + 预设快速填充 + 外观）

- **书架组件 (2 个):**
  - `LibraryView.tsx` — 书架视图（空状态引导 + 书籍网格）
  - `BookCard.tsx` — 书籍卡片（封面占位、格式标签、进度条）

- **阅读器组件 (1 个):**
  - `ReaderView.tsx` — 阅读器占位（显示书籍信息 + 引擎开发中提示）

- **AI 组件 (1 个):**
  - `AiPanel.tsx` — AI 对话面板（聊天界面 + 未配置引导）

- **音乐组件 (1 个):**
  - `MusicPlayer.tsx` — 音乐播放器（迷你播放器 + 完整播放列表面板）

**状态管理 (2 个文件):**
- `stores/appStore.ts` — 全局状态（视图、主题、书架、AI 配置、侧边栏）
- `stores/musicStore.ts` — 音乐播放器状态（播放列表、播放控制、UI 状态、预置曲目）

**工具库 (1 个文件):**
- `lib/aiService.ts` — AI 客户端（OpenAI 兼容协议，chat/ask/summarize/translate/explain）

**项目文档 (5 个文件):**
- `README.md` — 项目说明、快速开始、隐私声明
- `LICENSE` — MIT 开源许可证
- `docs/01-product-design.md` — 产品设计文档（背景、架构、功能清单、隐私安全）
- `docs/02-architecture-decisions.md` — 技术决策记录 (ADR × 5)
- `docs/03-music-player-spec.md` — 音乐播放器功能规格
- `docs/04-dev-log.md` — 本文件，开发日志

### 关键设计决策

1. **Electron + React + TypeScript** — 生态成熟，维护门槛低
2. **仅支持 OpenAI 兼容 API** — 不绑供应商，不打包本地模型
3. **音乐版权合规** — 预置曲目全部来自 Pixabay 免版权库，不打包音频文件
4. **隐私优先** — API Key 仅存本地，零遥测，.gitignore 严格防护
5. **AI 前移** — Phase 1 即集成 AI 框架和配置界面

### 下一步操作

**不再需要手动敲命令！** 双击以下 bat 文件即可：

1. `install.bat` → 安装依赖
2. `start.bat` → 启动开发模式
3. `build.bat` → 构建打包

---

## 2026-07-11 — 第二轮：bat 文件 + 存储方案调整

### 新增

- `install.bat` — 一键安装依赖（自动清理残留进程 + 清理旧 electron + npm install）
- `start.bat` — 一键启动开发（自动检查依赖 + 补装缺失 + npm run dev）
- `build.bat` — 一键构建打包（编译 + 打包 Windows 安装包）
- `CLAUDE.md` — 项目级指令文件
- `D:\00_AIT_Work\CLAUDE.md` — AIT Work 全局黄金准则
- `src/main/storage.ts` — 轻量 JSON 文件存储（替代 better-sqlite3）

### 变更

- **存储方案：** better-sqlite3 → 纯 JS JSON 文件存储
  - 原因：better-sqlite3 需要 C++ 编译（node-gyp），当前环境无 VS Build Tools
  - 方案：JsonStore 类，数据存 Electron userData 目录，零编译依赖
  - 后续：数据量大时可迁移到 sql.js (WASM) 或 better-sqlite3
- **package.json：** 移除 better-sqlite3 和 @types/better-sqlite3
- **electron.vite.config.ts：** 移除 better-sqlite3 external 配置
- **主进程：** 新增 storage:get / storage:set IPC 处理器
- **预加载：** 新增 storage API 暴露
- **预置曲目：** 添加到 Pixabay CDN 链接
