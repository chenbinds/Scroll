# CLAUDE.md — 卷轴 Scroll

> 项目级指令。全局准则见 `D:\00_AIT_Work\CLAUDE.md`。

## 技术栈

- Electron 31 + React 18 + TypeScript
- electron-vite 构建，Tailwind CSS 样式
- Zustand 状态管理，JSON 文件存储
- JSZip 自研 EPUB 解析器
- pdf.js PDF 渲染
- Web Audio API 音乐生成
- **MOBI/AZW3：** foliate-js（与 Koodo 同源）直接解析 → MobiReader 渲染
- **MOBI/AZW3 旧方案：** 自研/半移植解析器、Calibre 转换 —— 已废弃

## 启动方式

| 用途 | 命令/文件 | 说明 |
|------|-----------|------|
| 开发 | `start.bat` | electron-vite dev，秒开 |
| 生产 | `Scroll.vbs` | 跑 `out/` 构建产物 |
| 构建 | `rebuild.bat` | 只构建代码（不含打包） |
| 打包 | `build.bat` | 构建 + 打包 Scroll.exe |
| 环境 | `setup_calibre.bat` | （已废弃，MOBI 改用 foliate-js，无需 Calibre） |

## 目录结构

```
scroll-ebook-reader/
├── src/main/         # Electron 主进程（窗口、IPC、存储、ebook-convert）
├── src/preload/      # contextBridge 安全桥接
├── src/renderer/     # React 渲染进程
│   └── src/
│       ├── components/layout/   # AppShell, TopBar, Sidebar, TocPanel, BookmarkPanel
│       ├── components/library/  # LibraryView, BookCard
│       ├── components/reader/   # EpubReader, TxtReader, PdfReader, MobiReader, ComicReader
│       ├── components/ai/       # AiPanel
│       ├── components/music/    # MusicPlayer
│       ├── stores/              # Zustand (appStore, musicStore)
│       └── lib/
│           ├── epubParser.ts    # EPUB 解析：JSZip + DOMParser NCX
│           ├── mobiParser.ts    # MOBI 内置解析器（Calibre 不可用时回退）
│           ├── comicParser.ts   # CBZ/CBR 解析
│           ├── txtParser.ts     # TXT 正则分章
│           ├── i18n.ts          # 国际化
│           └── aiService.ts     # AI 聊天
├── tools/            # （遗留）旧 Calibre Portable 目录，可忽略
├── docs/             # 项目文档
└── out/              # electron-vite 构建产物
```

## MOBI/AZW3 处理架构

```
MOBI/AZW3 文件
    │
    └── foliate-js (mobi.js) → 章节 HTML → MobiReader 全量渲染
        （PalmDOC / HUFF-CDIC / KF8 均由 foliate-js 处理）
```

封面：`extractMobiCover()` 从 EXTH coverOffset 提取。

## 各格式阅读器状态

| 格式 | 组件 | 状态 | 备注 |
|------|------|------|------|
| EPUB | EpubReader | ✅ 稳定 | 全量渲染、树状 TOC、进度恢复 |
| TXT/MD | TxtReader | ✅ 稳定 | 正则分章 |
| PDF | PdfReader | ✅ 稳定 | pdf.js canvas，IntersectionObserver 懒渲染 |
| MOBI/AZW3 | MobiReader | ✅ 主路径 | foliate-js（Koodo 同源引擎） |
| CBZ | ComicReader | ✅ 可用 | JSZip 提取图片 |
| CBR | ComicReader | ⚠️ 未实测 | RAR 4.x stored 文件 |
| DJVU | ReaderView | ❌ 未实现 | 占位 |

## 核心架构决策

### EPUB 渲染：全量渲染
- 绝大多数电子书 < 200 章，直接 `dangerouslySetInnerHTML`
- 不要做懒加载/虚拟章节

### TOC 导航：callback ref + Zustand
- EpubReader callback ref → `_readerEl` 存 Zustand
- TocPanel 读 store → `querySelector` + `scrollTo`

### NCX 解析：DOMParser，禁止正则
- `<navPoint>` 可嵌套，正则处理不了

### MOBI 解析：使用 foliate-js，不要自研
- 与 Koodo Reader 同源（foliate-js / mobi.js）
- 不要半移植、不要捆绑 Calibre（~200MB）
- 复杂二进制格式交给成熟库，只做阅读器 UI 与章节渲染

## 已完成功能（2026-07-13）

1. ✅ EPUB/TXT/PDF/CBZ 阅读器
2. ✅ MOBI/AZW3：foliate-js 直接解析（与 Koodo 同源，无需 Calibre）
3. ✅ 暗色/亮色模式、书签、AI 聊天、音乐播放
4. ✅ **阅读主题**：5 色背景 + 3 种字体（仅内容区），CSS 变量方案
5. ✅ **EPUB/MOBI 封面提取**：EPUB 直接提取，MOBI 经 foliate-js EXTH 提取，PDF 首页缩略图
6. ✅ **豆瓣评分**：Node.js https 请求 → 解析内嵌 JSON → 书架封面显示 ⭐ 评分
7. ✅ **角标图片修复**：`max-height: 1.4em` 限制小图尺寸

## 待实现功能

1. 豆瓣评分调试（当前 Node.js https 请求可能被豆瓣限流，需进一步测试）
2. DJVU 阅读器
3. 字体缩放全局持久化（目前每个 reader 独立 fontSize）
4. CBR 漫画完善（低优先级）
5. 用真实 MOBI/AZW3 样书回归验证（含原 HUFF/CDIC 问题书）
