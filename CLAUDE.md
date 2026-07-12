# CLAUDE.md — 卷轴 Scroll

> 项目级指令。全局准则见 `D:\00_AIT_Work\CLAUDE.md`。

## 技术栈

- Electron 31 + React 18 + TypeScript
- electron-vite 构建，Tailwind CSS 样式
- Zustand 状态管理，JSON 文件存储
- JSZip 自研 EPUB 解析器
- pdf.js PDF 渲染
- Web Audio API 音乐生成
- **MOBI/AZW3 解析引擎：** 移植自 Koodo Reader（`kookit/mobi.js`，GPL v3）

## 启动方式

双击 `Scroll.vbs`（生产模式，跑 `out/` 构建产物）
或双击 `start.bat`（开发模式）

每次改完代码 **必须** `npx electron-vite build` 才能通过 Scroll.vbs 生效。

## 目录结构

```
scroll-ebook-reader/
├── src/main/         # Electron 主进程（窗口、IPC、存储）
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
│           ├── mobiParser.ts    # MOBI/AZW3 解析：Koodo Reader 引擎移植
│           ├── comicParser.ts   # CBZ/CBR 解析
│           ├── txtParser.ts     # TXT 正则分章
│           ├── i18n.ts          # 国际化
│           └── aiService.ts     # AI 聊天
├── docs/             # 项目文档
└── out/              # electron-vite 构建产物（Scroll.vbs 跑这个）
```

## 核心架构决策（吸取的教训）

### 1. EPUB 渲染：全量渲染，不要虚拟章节

**踩坑：** N 轮修复试图做"虚拟章节"（只渲染可见章节 + 占位符），导致占位符高度估算不准 → scrollbar 抖动 → 空白区。

**结论：** 绝大多数电子书 < 200 章，总 HTML < 5MB，直接全量 `dangerouslySetInnerHTML`。**不要做任何形式的懒加载。**

### 2. TOC 导航：callback ref + Zustand，不用模块 ref

**踩坑：** 多次尝试 `useEffect` / `useLayoutEffect` / 模块级 ref 实现 TocPanel → EpubReader 通信，全部有时序空洞。

**结论：** EpubReader 用 callback ref 把滚动容器 DOM 存到 Zustand `_readerEl`。TocPanel 直接从 store 读 DOM，手动 `querySelector` + `scrollTo`。

### 3. NCX 解析：用 DOMParser，禁止正则

**踩坑：** `<navPoint>` 可以嵌套，正则 `<navPoint[^>]*>([\s\S]*?)<\/navPoint>` 遇到嵌套会把子节点吞掉。

**结论：** `new DOMParser().parseFromString(xml, 'text/xml')` + 递归 `querySelectorAll(':scope > navPoint')`。

### 4. Fragment 锚点必须支持

NCX 子目录的 `src` 带 `#fragment`。导航时从 `href` 提取 `#fragment`，在章节 DOM 内用 `querySelector` 精确定位。

### 5. 进度恢复：scrollTop 百分比 + 重试

用 `scrollHeight * percent / 100` 计算 `scrollTop`，配合 `setTimeout` 重试（最多 10 次）。

### 6. MOBI 解析器的教训（2026-07-12）

**最大教训：不要从零实现复杂二进制格式解析器。** 用现有成熟方案。

- 从 PalmDOC 算法开始自己实现 → 反复调试 → 始终有边缘 case 乱码
- 最终移植 Koodo Reader (`kookit/mobi.js`) 的完整解析引擎，效果显著改善
- 自研解析器投入产出比极低——应优先复用开源实现

## 各格式阅读器状态

| 格式 | 组件 | 状态 | 备注 |
|------|------|------|------|
| EPUB | EpubReader | ✅ 稳定 | 全量渲染、树状 TOC、进度恢复 |
| TXT/MD | TxtReader | ✅ 稳定 | 正则分章 |
| PDF | PdfReader | ✅ 稳定 | pdf.js canvas，IntersectionObserver 懒渲染 |
| MOBI6 (PalmDOC) | MobiReader | ⚠️ 基本可用 | Koodo 引擎移植，`�` 已处理，偶尔 HTML 标签断裂 |
| AZW3/KF8 (PalmDOC) | MobiReader | ⚠️ 基本可用 | 多文档结构已处理，少量边缘 case |
| AZW3/KF8 (HUFF/CDIC) | MobiReader | ❌ 严重乱码 | 解压输出内容但质量极差，需重新实现 |
| MOBI v7 (无压缩) | MobiReader | ❌ 不支持 | 少见格式，内容直接乱码 |
| CBZ | ComicReader | ✅ 可用 | JSZip 提取图片 |
| CBR | ComicReader | ⚠️ 未实测 | RAR 4.x stored 文件，无测试文件 |
| DJVU | ReaderView | ❌ 未实现 | 占位 |

## 当前主要问题

1. **HUFF/CDIC 压缩的 AZW3 文件解析失败** — "权力"等文件虽然能打开，但内容乱码
2. **MOBI 解析稳定性** — PalmDOC 文件偶尔有 HTML 标签断裂（如 `<table>` 变成 `lass="...">`）
3. **CBR 漫画格式未实测** — 没有测试文件，RAR 解压逻辑未经验证

## 待实现功能（按优先级）

1. HUFF/CDIC 压缩的 MOBI/AZW3 正确解析（如"权力"）
2. 阅读主题系统（亮/纸/护眼/暗/自然 + 字体选择）
3. 书籍封面提取
4. 豆瓣评分集成
5. CBR 漫画完善
6. DJVU 支持
