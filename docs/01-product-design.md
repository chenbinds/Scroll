# 卷轴 Scroll — 产品设计文档

> 版本: v0.1.0 | 日期: 2026-07-11 | 作者: Brandon Chen

---

## 1. 项目背景

### 1.1 起源

**DocBox（稻壳阅读器）** 是一款优秀的 Windows 多格式电子书阅读器，支持 PDF、EPUB、MOBI、TXT、CBZ 等 30+ 种格式。2024 年因被金山起诉后从官方渠道下架，停止更新。

用户（Brandon Chen）长期使用 DocBox 阅读电子书，安装路径：`D:\02_软件\DocBox`。因该工具已停更且官网关闭，决定自建替代品。

### 1.2 定位

**AI 增强的本地电子书阅读器**，在继承 DocBox 优秀体验的基础上加入 AI 智能助手能力。

### 1.3 核心差异化

| 对比维度 | DocBox 稻壳 | 卷轴 Scroll |
|----------|------------|-------------|
| 格式支持 | 30+ 种 | PDF/EPUB/MOBI/TXT/CBZ/DJVU |
| AI 能力 | 无 | 智能摘要、翻译、问答、概念解释 |
| 在线文库 | 有（已失效） | 无（专注本地阅读） |
| 开源 | 否 | 是 (MIT) |
| 跨平台 | 仅 Windows | 先 Windows，架构预留跨平台 |
| 音乐播放 | 无 | 支持网络流媒体 + 本地文件 |

---

## 2. 技术架构

### 2.1 总体架构

```
┌────────────────────────────────────────────┐
│              Electron Shell                 │
│  ┌──────────┐  ┌────────────────────────┐  │
│  │ Main      │  │  Renderer (React)      │  │
│  │ Process   │  │                        │  │
│  │           │  │  AppShell → Views      │  │
│  │ • IPC     │◄─┤  • LibraryView         │  │
│  │ • DB      │  │  • ReaderView          │  │
│  │ • AI 代理 │  │  • AiPanel             │  │
│  │ • 解析器  │  │  • MusicPlayer         │  │
│  └──────────┘  └────────────────────────┘  │
└────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层 | 技术 | 理由 |
|---|------|------|
| 桌面壳 | Electron 31 | 生态成熟，Windows 支持好 |
| 前端 | React 18 + TypeScript | 生态大，组件丰富 |
| 构建 | electron-vite + Vite | 开发体验好 |
| 样式 | Tailwind CSS 3 | 暗色模式天然支持 |
| 状态管理 | Zustand | 轻量，TS 友好 |
| 本地数据库 | better-sqlite3 | 零配置，嵌入式 |
| PDF | pdf.js (Mozilla) | 浏览器原生 |
| EPUB | epub.js | JS 原生 |
| AI 协议 | OpenAI 兼容 API | 通用，不绑定供应商 |
| 音频 | HTML5 Audio API | 无需额外依赖 |

### 2.3 AI 架构

```
用户配置 → OpenAI 兼容 API 设置
              ↓
渲染进程 → IPC → 主进程 → fetch()
              ↓
         返回结果 → 渲染进程展示
```

**不**使用本地模型（Ollama），保持轻量。支持所有兼容 OpenAI 协议的 API：
- DeepSeek
- OpenAI
- 通义千问
- Moonshot
- 智谱 GLM
- SiliconFlow
- 自定义端点

---

## 3. 功能设计

### 3.1 功能清单（2026-07-11 更新）

| 功能 | Phase | 状态 |
|------|-------|------|
| Electron + React 脚手架 | P1 | ✅ |
| 书架管理（导入/展示/进度条） | P1 | ✅ |
| AI 聊天面板 | P1 | ✅ |
| AI 服务配置（OpenAI 兼容） | P1 | ✅ |
| 暗色/亮色主题 | P1 | ✅ |
| 音乐播放器（Web Audio + URL + 本地） | P1 | ✅ |
| PDF 阅读引擎（pdf.js） | P2 | ✅ |
| EPUB 阅读引擎（自研 JSZip 解析） | P2 | ✅ 全量渲染 + 树状TOC + fragment跳转 |
| TXT/Markdown 阅读（正则分章） | P2 | ✅ |
| 目录导航（TOC Panel） | P2 | ✅ 树状多层级 |
| 书签功能（添加/删除/持久化/跳转） | P2 | ✅ |
| 阅读进度持久化（章节+百分比恢复） | P2 | ✅ |
| 阅读主题系统（5套主题+5种字体） | P3 | 📋 下一步 |
| 书籍封面提取 | P3 | 📋 下一步 |
| 豆瓣评分集成 | P3 | 📋 下一步 |
| MOBI/AZW3 支持 | P3 | 📋 下一步 |
| 标注系统（高亮+批注） | P3 | 📋 计划中 |
| CBZ/CBR 漫画 | P4 | 📋 计划中 |
| DJVU 支持 | P4 | 📋 计划中 |
| AI 深度集成（RAG） | P4 | 📋 计划中 |

### 3.2 音乐播放器设计

**功能：**
- 网络流媒体播放（URL 输入）
- 本地音乐文件导入
- 内置免版权曲目（来自 Pixabay Music）
- 迷你播放器（阅读时底部显示）
- 完整播放列表面板

**版权策略：**
1. 内置预置曲目全部来自 Pixabay Music 免版权库
2. 用户自行添加的 URL/文件由用户自行负责版权
3. 界面中明确标注版权信息和来源
4. 不存储、不分发任何音乐文件
5. README 和代码注释中标注版权声明

---

## 4. 项目结构

```
scroll-ebook-reader/
├── src/
│   ├── main/                    # Electron 主进程
│   │   └── index.ts             # 窗口管理、IPC、AI 代理
│   ├── preload/
│   │   └── index.ts             # contextBridge 安全 API
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx          # 根组件
│           ├── main.tsx         # React 入口
│           ├── globals.css      # 全局样式 + Tailwind
│           ├── env.d.ts         # TypeScript 声明
│           ├── components/
│           │   ├── layout/      # AppShell, TopBar, Sidebar, SettingsDialog
│           │   ├── library/     # LibraryView, BookCard
│           │   ├── reader/      # ReaderView
│           │   ├── ai/          # AiPanel
│           │   └── music/       # MusicPlayer
│           ├── stores/          # Zustand stores
│           │   ├── appStore.ts  # 全局状态
│           │   └── musicStore.ts # 音乐播放器状态
│           └── lib/
│               └── aiService.ts # AI 客户端（OpenAI 兼容）
├── docs/                        # 项目文档
├── resources/                   # 打包资源（图标等）
├── .env.example                 # 环境变量示例（安全提交）
├── .gitignore                   # 隐私保护规则
└── package.json
```

---

## 5. 隐私与安全

### 5.1 原则

- API Key 仅存本地，不上传任何服务器
- 零遥测、零数据收集
- 所有 AI 请求直达用户配置的 API 端点
- AI 请求通过主进程代理（避免渲染进程暴露 API Key）

### 5.2 .gitignore 保护

以下文件类型被排除：
- `.env` 及所有环境变量文件
- `*.sqlite`, `*.db` 数据库文件
- `config.json`, `settings.json` 用户配置
- 日志和临时文件

### 5.3 API Key 安全

- 配置界面中 API Key 默认密码遮蔽
- 仅存储于 Electron `userData` 目录
- 不在日志中打印 API Key
- AI 请求仅在主进程发起（preload 不暴露原始 fetch）

---

## 6. 迭代计划

### Phase 1 (当前): 脚手架 + AI 框架 + 音乐
- Electron + React + Tailwind 基础 UI
- 书架管理（导入/展示）
- AI 聊天面板 + 配置
- 音乐播放器

### Phase 2: 核心阅读引擎
- PDF 渲染（pdf.js）
- EPUB 渲染（epub.js）
- MOBI/AZW3 解析
- TXT/Markdown 章节分章

### Phase 3: 阅读体验
- 标注系统
- 书签功能
- 目录导航
- 阅读进度持久化

### Phase 4: 扩展
- CBZ/CBR 漫画
- DJVU 支持
- AI RAG 深度集成
- 阅读统计
