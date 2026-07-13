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

---

## 2026-07-11 — 阅读器核心功能修复（多轮迭代）

### 问题

1. EPUB TOC 点击无效（N 轮修复才找到根因）
2. 页面滚动卡顿（虚拟章节架构问题）
3. 阅读进度无法恢复
4. 书签功能无效

### 解决过程

**第 1-4 轮：** 在虚拟章节框架内修复（全部失败）
- 尝试 `IntersectionObserver` 优化、`useEffect` 导航、模块 ref 等
- 根本问题：虚拟章节的占位符高度估算永远不准 + 激活逻辑不可靠

**第 5 轮：** 废弃虚拟章节，全量渲染
- 删除 `renderedChapters` / `ChapterPlaceholder` / `ChapterList` / scroll 激活
- EpubReader 代码从 345 行减到 ~170 行
- 滚动流畅问题解决

**第 6-8 轮：** 修复 TOC 导航
- 尝试 `useLayoutEffect` + 模块 ref → 时序空洞
- 尝试 callback ref + Zustand `_readerEl` → 成功
- 发现 `parseNcx` 正则无法处理嵌套 `<navPoint>` → 改 DOMParser 递归
- 发现 fragment 锚点未支持 → 加 `querySelector('#' + fragment)`

**第 9 轮：** 修复进度恢复
- `scrollIntoView` 不可靠 → 改用百分比 `scrollTop` 计算
- 增加重试机制应对 DOM 延迟布局

### 新增架构决策

见 `docs/02-architecture-decisions.md` ADR-006 至 ADR-010。

### 当前状态

- ✅ EPUB 阅读（全量渲染、树状 TOC、fragment 跳转、进度恢复）
- ✅ TXT 阅读（全量渲染、正则分章、TOC、进度恢复）
- ✅ PDF 阅读（pdf.js、页码进度）
- ✅ 书签（持久化、点击跳转）
- 📋 待做：阅读主题、封面、豆瓣评分、MOBI/AZW3

---

## 2026-07-13 — 阅读标注 + 多格式 + 工程收口

### 标注功能
- 顶栏：标记 / 画笔（8 图形）/ 橡皮擦 / 手动保存
- 视口级兄弟 canvas；归一化坐标；独立 `annotations_{bookId}` JSON
- 离开统一 React 弹窗（书架 / Esc / 窗口 X）；禁止 MessageBox 双轨
- EPUB + MOBI/AZW/AZW3 全套；PDF 画笔/橡皮（标记禁用）
- 笔记弹窗字数上限 1000；fixed 定位防裁切
- 阅读工具栏去掉书名；「返回书架」改为醒目按钮

### 工程整理
- 清理 vite 临时配置、boot 日志、豆瓣临时脚本、`copy_calibre.bat`、`install_calibre.bat`、`setup_calibre.bat`、`make.bat`（与 `build.bat` 重复）、旧 `info/` 调研
- Handoff 归档至 `Information/archive/`；现行 `Information/Handoff_标注_2026-07-13.md`
- 新增根目录 `TODO.md`（音乐 / AI / 标注后续 / DJVU 等）
- 更新 `HANDOFF.md`、`CLAUDE.md`、`.gitignore`
