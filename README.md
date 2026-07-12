# 卷轴 Scroll

> AI 增强的本地电子书阅读器

## 项目背景

**卷轴 Scroll** 是一款开源的多格式本地电子书阅读器，支持 EPUB、MOBI/AZW3、PDF、TXT、CBZ/CBR 等格式，内置 AI 阅读助手。

## 核心特性

- **多格式支持** — EPUB、MOBI/AZW3、PDF、TXT、Markdown、CBZ/CBR
- **AI 阅读助手** — 智能摘要、翻译、概念解释（OpenAI 兼容 API）
- **书架管理** — 导入、进度追踪
- **书签系统** — 添加/删除/跳转
- **音乐播放器** — Web Audio API 实时生成氛围音
- **暗色模式** — 舒适的长时阅读体验
- **中英双语** — 界面语言切换
- **本地优先** — 所有数据存储在本机

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 31 |
| 前端 | React 18 + TypeScript |
| 构建 | Vite + electron-vite |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| PDF 引擎 | pdf.js (Mozilla) |
| EPUB 引擎 | JSZip 自研解析器 |
| MOBI 引擎 | 移植自 Koodo Reader（GPL v3） |
| AI 协议 | OpenAI 兼容 API |

## 快速开始

### 环境要求
- Node.js 20+
- Windows 10/11

### 安装运行
```
双击 install.bat   # 安装依赖
双击 start.bat     # 启动开发模式
双击 Scroll.vbs    # 启动生产模式
```

### 配置 AI 服务
1. 点击右上角 设置
2. 填入 API 地址、API Key、模型名称
3. 支持 DeepSeek / OpenAI / 通义千问 / Moonshot / GLM 等

## 各格式阅读器状态

| 格式 | 状态 | 备注 |
|------|------|------|
| EPUB | ✅ 稳定 | 全量渲染，树状 TOC，fragment 导航，进度恢复 |
| PDF | ✅ 稳定 | pdf.js canvas，分页渲染 |
| TXT/MD | ✅ 稳定 | 正则分章 |
| MOBI6 (PalmDOC) | ⚠️ 基本可用 | 文本可读，偶有 HTML 标签断裂 |
| AZW3/KF8 (PalmDOC) | ⚠️ 基本可用 | 多文档合并，少量边缘 case |
| AZW3 (HUFF/CDIC) | ❌ 乱码 | "权力"等文件解压输出不可读 |
| CBZ | ✅ 可用 | JSZip 提取图片，缩放翻页 |
| CBR | ⚠️ 未实测 | 基础 RAR 4.x stored 文件，无测试文件 |
| DJVU | ❌ 未实现 | 占位 |

## 路线图

- [x] Electron + React 脚手架
- [x] EPUB/TXT/PDF 阅读引擎
- [x] AI 聊天面板
- [x] 书架 + 书签系统
- [x] 音乐播放器
- [x] 暗色/亮色主题
- [x] 中英双语
- [x] MOBI6/AZW3 (PalmDOC) 阅读
- [x] CBZ 漫画浏览
- [ ] HUFF/CDIC 压缩 MOBI/AZW3
- [ ] 阅读主题系统（字体、配色）
- [ ] 书籍封面提取
- [ ] 豆瓣评分集成
- [ ] CBR 完善
- [ ] DJVU 支持

## 项目结构

```
scroll-ebook-reader/
├── src/main/              # Electron 主进程
├── src/preload/           # contextBridge 安全桥接
├── src/renderer/          # React 渲染进程
│   └── src/
│       ├── components/
│       │   ├── layout/    # 布局组件 (AppShell, TocPanel, BookmarkPanel)
│       │   ├── library/   # 书架
│       │   ├── reader/    # 阅读器 (Epub, Txt, Pdf, Mobi, Comic)
│       │   ├── ai/        # AI 面板
│       │   └── music/     # 音乐播放器
│       ├── stores/        # Zustand 状态管理
│       └── lib/           # 解析器 (epub, mobi, txt, comic)
├── resources/             # 打包资源
├── Scroll.vbs             # 生产模式启动
├── start.bat              # 开发模式启动
├── install.bat            # 安装依赖
└── build.bat              # 构建
```

## License

MIT © Brandon Chen
MOBI/AZW3 解析引擎部分基于 Koodo Reader（GPL v3）
