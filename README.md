# 卷轴 Scroll 📜

> AI 增强的本地电子书阅读器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6)

## 项目背景

**卷轴 Scroll** 是 [DocBox（稻壳阅读器）](https://www.docbox.com) 的开源替代品。

DocBox 是一款优秀的 Windows 多格式电子书阅读器，支持 PDF、EPUB、MOBI、TXT、CBZ 等 30+ 种格式，但因版权纠纷已于 2024 年停止更新并从官方渠道下架。

卷轴在继承 DocBox 优秀体验的基础上，增加了 AI 智能助手能力，让你不只是"读书"，还能"与书对话"。

## 核心特性

- 📖 **多格式支持** — PDF、EPUB、MOBI/AZW3、TXT、Markdown、CBZ/CBR、DJVU
- 🤖 **AI 阅读助手** — 智能摘要、翻译、概念解释、自由问答
- 🏠 **本地优先** — 所有数据存储在本机，不上传任何阅读记录
- 🌙 **暗色模式** — 舒适的长时阅读体验
- 📑 **多标签阅读** — 同时打开多本书（开发中）
- ✍️ **标注系统** — 高亮、批注、书签（开发中）

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 31 |
| 前端 | React 18 + TypeScript |
| 构建 | Vite + electron-vite |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 本地数据库 | better-sqlite3 |
| PDF 引擎 | pdf.js (Mozilla) |
| EPUB 引擎 | epub.js |
| AI 协议 | OpenAI 兼容 API |

## 快速开始

### 环境要求

- Node.js 20+
- npm 或 pnpm
- Windows 10/11

### 开发

```bash
# 克隆仓库
git clone https://github.com/brandonchen/scroll-ebook-reader.git
cd scroll-ebook-reader

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 打包为 Windows 安装包
npm run package
```

### 配置 AI 服务

卷轴支持所有兼容 OpenAI 协议的 AI 服务。启动应用后：

1. 点击右上角 ⚙ 设置
2. 在 AI 服务配置中填入：
   - **API 地址** — 如 `https://api.deepseek.com/v1`
   - **API Key** — 你的 API 密钥
   - **模型名称** — 如 `deepseek-chat`
3. 点击保存

支持的 AI 服务（任何兼容 OpenAI 协议的均可）：

| 服务 | 预设 |
|------|------|
| DeepSeek | ✅ |
| OpenAI | ✅ |
| 通义千问 | ✅ |
| Moonshot | ✅ |
| 智谱 GLM | ✅ |
| SiliconFlow | ✅ |
| 自定义 | ✅ |

## 项目结构

```
scroll-ebook-reader/
├── src/
│   ├── main/              # Electron 主进程
│   │   └── index.ts       # 窗口管理 + IPC
│   ├── preload/           # 预加载脚本
│   │   └── index.ts       # contextBridge API
│   └── renderer/          # React 渲染进程
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── components/
│           │   ├── layout/    # 布局组件
│           │   ├── library/   # 书架
│           │   ├── reader/    # 阅读器
│           │   └── ai/        # AI 面板
│           ├── stores/        # Zustand 状态
│           └── lib/           # 工具 & AI 服务
├── resources/              # 打包资源
└── package.json
```

## 隐私 & 安全

- ✅ API Key 仅存储在本机应用数据目录，不上传
- ✅ 无任何遥测或数据收集
- ✅ `.env` 和配置文件已在 `.gitignore` 中排除
- ✅ 所有 AI 请求直接发送到你配置的 API 端点
- ✅ 开源可审计

## 路线图

- [x] Phase 1: Electron + React 脚手架
- [x] AI 服务框架（OpenAI 兼容协议）
- [ ] Phase 2: PDF 阅读引擎（pdf.js）
- [ ] Phase 3: EPUB/MOBI/TXT 阅读引擎
- [ ] Phase 4: 标注、书签系统
- [ ] Phase 5: CBZ/DJVU 支持
- [ ] Phase 6: AI RAG 深度集成

## License

MIT © Brandon Chen
