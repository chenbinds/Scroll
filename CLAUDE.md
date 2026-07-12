# CLAUDE.md — 卷轴 Scroll

> 项目级指令。全局准则见 `D:\00_AIT_Work\CLAUDE.md`。

## 技术栈

- Electron 31 + React 18 + TypeScript
- electron-vite 构建，Tailwind CSS 样式
- Zustand 状态管理，JSON 文件存储
- JSZip 自研 EPUB 解析器
- pdf.js PDF 渲染
- Web Audio API 音乐生成
- **MOBI/AZW3：** Calibre `ebook-convert` 转 EPUB（主要路径）→ EpubReader 渲染
- **MOBI/AZW3 内置解析器：** Koodo Reader 移植（Calibre 不可用时回退）

## 启动方式

| 用途 | 命令/文件 | 说明 |
|------|-----------|------|
| 开发 | `start.bat` | electron-vite dev，秒开 |
| 生产 | `Scroll.vbs` | 跑 `out/` 构建产物 |
| 构建 | `rebuild.bat` | 只构建代码（不含打包） |
| 打包 | `build.bat` | 构建 + 打包 Scroll.exe |
| 环境 | `setup_calibre.bat` | 下载 Calibre Portable（一次性，~130MB） |

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
├── tools/            # Calibre Portable（.gitignore，setup_calibre.bat 下载）
├── docs/             # 项目文档
└── out/              # electron-vite 构建产物
```

## MOBI/AZW3 处理架构

```
MOBI/AZW3 文件
    │
    ├── Calibre 可用？
    │   ├── YES → ebook-convert → EPUB → EpubReader（完美：目录/图片/缩放/编码）
    │   └── NO  → 内置 MobiReader（基本可用，~90-95% 正确率）
    │
    └── 换书时：先清 convertedEpubPath(null)，避免闪现旧书
```

**Calibre 路径优先级：**
1. `tools/calibre-portable/Calibre/ebook-convert.exe`（项目内置）
2. `C:/Program Files/Calibre2/ebook-convert.exe`（系统安装）
3. `ebook-convert`（PATH）

**分发时** `build.bat` 通过 `electron-builder.yml` 的 `extraResources` 自动把 `tools/` 目录打包进 `Scroll.exe`，实现开箱即用。

## 各格式阅读器状态

| 格式 | 组件 | 状态 | 备注 |
|------|------|------|------|
| EPUB | EpubReader | ✅ 稳定 | 全量渲染、树状 TOC、进度恢复 |
| TXT/MD | TxtReader | ✅ 稳定 | 正则分章 |
| PDF | PdfReader | ✅ 稳定 | pdf.js canvas，IntersectionObserver 懒渲染 |
| MOBI/AZW3 | EpubReader | ✅ 完美 | Calibre ebook-convert 转 EPUB |
| MOBI/AZW3 | MobiReader | ⚠️ 回退 | Calibre 不可用时的内置解析器 |
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

### MOBI 解析：不要自己造
- 最大教训：**复杂二进制格式直接用成熟方案（Calibre），不要自己写解析器**
- PalmDOC、HUFF/CDIC、trailing bytes——每个都是坑
- Koodo 移植版花费十几次 commit 仍只有 90-95% 正确率
- Calibre `ebook-convert` 一行命令解决所有问题

## 待实现功能（按优先级）

1. 阅读主题系统（亮/纸/护眼/暗/自然 + 字体选择）
2. 书籍封面提取
3. 豆瓣评分集成
4. CBR 漫画完善
5. DJVU 支持
