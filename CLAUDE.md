# CLAUDE.md — 卷轴 Scroll

> 项目级指令。全局准则见 `D:\00_AIT_Work\CLAUDE.md`。

## 技术栈

- Electron 31 + React 18 + TypeScript
- electron-vite 构建，Tailwind CSS 样式
- Zustand 状态管理，JSON 文件存储
- JSZip 自研 EPUB 解析器（非 epub.js）
- pdf.js PDF 渲染
- Web Audio API 音乐生成

## 启动方式

双击 `Scroll.vbs`（生产模式，跑 `out/` 构建产物）
或双击 `start.bat`（开发模式）

## 目录结构

```
scroll-ebook-reader/
├── src/main/         # Electron 主进程（窗口、IPC、存储）
├── src/preload/      # contextBridge 安全桥接
├── src/renderer/     # React 渲染进程
│   └── src/
│       ├── components/layout/   # AppShell, TopBar, Sidebar, TocPanel, BookmarkPanel
│       ├── components/library/  # LibraryView, BookCard
│       ├── components/reader/   # EpubReader, TxtReader, PdfReader, ReaderView
│       ├── components/ai/       # AiPanel
│       ├── components/music/    # MusicPlayer
│       ├── stores/              # Zustand (appStore, musicStore)
│       └── lib/                 # epubParser, txtParser, aiService, i18n
├── docs/             # 项目文档
└── out/              # electron-vite 构建产物（Scroll.vbs 跑这个）
```

## 核心架构决策（吸取的教训）

### 1. EPUB 渲染：全量渲染，不要虚拟章节

**踩坑：** N 轮修复试图做"虚拟章节"（只渲染可见章节 + 占位符），导致：
- 占位符高度估算不准 → scrollbar 抖动 → 空白区
- 懒加载激活不可靠 → 快速滚动漏内容
- 高度跳变触发级联重渲染 → 卡顿

**结论：** 绝大多数电子书 < 200 章，总 HTML < 5MB，直接全量 `dangerouslySetInnerHTML`，浏览器 500ms 渲染完毕。**不要做任何形式的懒加载。**

### 2. TOC 导航：callback ref + Zustand，不用模块 ref

**踩坑：** 多次尝试 `useEffect` / `useLayoutEffect` / 模块级 ref 实现 TocPanel → EpubReader 通信，全部有时序空洞。

**结论：** EpubReader 用 callback ref 把滚动容器 DOM 存到 Zustand `_readerEl`。TocPanel 直接从 store 读 DOM，手动 `querySelector` + `scrollTo`。这是唯一可靠的兄弟组件通信方式。

### 3. NCX 解析：用 DOMParser，禁止正则

**踩坑：** `<navPoint>` 可以嵌套，正则 `<navPoint[^>]*>([\s\S]*?)<\/navPoint>` 遇到嵌套会把子节点吞掉。

**结论：** `new DOMParser().parseFromString(xml, 'text/xml')` + 递归 `querySelectorAll(':scope > navPoint')`。

### 4. Fragment 锚点必须支持

**踩坑：** NCX 子目录的 `src` 带 `#fragment`，对应同一章的不同位置。不支持 fragment 会导致父子目录跳到同一个位置。

**结论：** 导航时从 `href` 提取 `#fragment`，在章节 DOM 内用 `querySelector('#' + fragment)` 精确定位。

### 5. 进度恢复：scrollTop 百分比 + 章节索引双保险

**踩坑：** `scrollIntoView` 在嵌套 DOM 中行为不一致。

**结论：** 用 `scrollHeight * percent / 100` 计算 `scrollTop`，配合 `setTimeout` 重试（最多 10 次）应对 DOM 延迟布局。同时保存 `chapterIndex` 作为 fallback。

### 6. 跨格式 TOC 生命周期

- EPUB/TXT：setToc + 注册 DOM ref
- PDF/CBZ：setToc([]) + 自动关闭 sidebar
- 回书架：setToc([])

## 各格式阅读器状态

| 格式 | 组件 | 渲染 | TOC | 进度 | 状态 |
|------|------|------|-----|------|------|
| EPUB | EpubReader | ✅ 全量 dangerouslySetInnerHTML | ✅ 树状 NCX+fragment | ✅ chapterIndex+percent | ✅ |
| TXT/MD | TxtReader | ✅ 全量 <p> | ✅ 正则分章 | ✅ percent | ✅ |
| PDF | PdfReader | ✅ pdf.js canvas | ❌ 无 | ✅ page-based | ✅ |
| MOBI/AZW3 | ReaderView | ❌ 占位 | ❌ | ❌ | ❌ 待实现 |
| CBZ/CBR | ReaderView | ❌ 占位 | ❌ | ❌ | ❌ 待实现 |
| DJVU | ReaderView | ❌ 占位 | ❌ | ❌ | ❌ 待实现 |

## 待实现功能（按优先级）

1. MOBI/AZW3 阅读引擎
2. 阅读主题系统（亮/纸/护眼/暗/自然 + 字体选择）
3. 书籍封面提取（EPUB 内嵌→base64、PDF 首页缩略图、TXT 自动生成）
4. 豆瓣评分集成
5. CBZ/CBR 漫画
6. DJVU 支持

## 关键代码模式

### 添加新格式阅读器

1. 创建 `src/renderer/src/components/reader/XxxReader.tsx`
2. 实现 Props 接口（filePath, onClose, onProgress, onTocReady）
3. 用 callback ref 设置 `useAppStore.getState()._setReaderEl(el)`
4. 在 App.tsx 的 `renderReader()` 添加 case
5. TOC 格式加入 `TOC_FORMATS` Set
