# CLAUDE.md — 卷轴 Scroll

> 项目级指令。全局准则见 `D:\00_AIT_Work\CLAUDE.md`。

## 技术栈

- Electron 31 + React 18 + TypeScript
- electron-vite 构建，Tailwind CSS 样式
- Zustand 状态管理，JSON 文件存储
- JSZip 自研 EPUB 解析器
- foliate-js MOBI/AZW3 解析
- pdf.js PDF 渲染
- Web Audio API 音乐生成

## 启动方式

| 用途 | 命令/文件 | 说明 |
|------|-----------|------|
| 日常 | `Scroll.vbs` | 优先 `release/Scroll.exe`，否则 electron + `out/` |
| 构建 | `rebuild.bat` | 只构建到 `out/` |
| 打包 | `build.bat` | 构建 + 便携 `release/Scroll.exe`（推荐日常） |
| 开发 | `start.bat` | electron-vite dev，调试用 |

## 目录结构

```
Scroll/
├── src/main/           # 主进程：窗口、IPC、存储、covers、douban
├── src/preload/        # contextBridge；启动时即发起 bootstrap
├── src/renderer/       # React UI
│   └── src/
│       ├── bootstrapHydrate.ts   # React 首屏前灌入 Zustand
│       ├── components/
│       │   ├── layout/           # AppShell, TopBar, Sidebars
│       │   ├── library/          # LibraryView, BookCard
│       │   ├── reader/           # Epub/Mobi/Txt/Pdf/Comic Reader
│       │   ├── ai/               # AiPanel
│       │   └── music/            # MusicPlayer
│       ├── stores/               # appStore, musicStore
│       └── lib/
│           ├── epubParser.ts     # EPUB：JSZip + DOMParser NCX
│           ├── mobiParser.ts     # MOBI：foliate-js 封装
│           ├── readingTheme.ts   # 阅读主题 + 整窗 CSS 变量
│           └── useReaderFontSize.ts
├── Information/        # 最新 handoff 文档
├── out/                # electron-vite 构建产物
└── release/            # electron-builder 便携包 Scroll.exe
```

## MOBI/AZW3

```
MOBI/AZW3 → foliate-js (mobi.js) → MobiReader 全量渲染
```

**禁止**自研二进制解析、**禁止**捆绑 Calibre。旧方案已废弃。

## 各格式状态

| 格式 | 组件 | 状态 |
|------|------|------|
| EPUB | EpubReader | ✅ |
| TXT/MD | TxtReader | ✅ |
| PDF | PdfReader | ✅ |
| MOBI/AZW3 | MobiReader | ✅ foliate-js |
| CBZ | ComicReader | ✅ |
| CBR | ComicReader | ⚠️ 仅 RAR stored，未实测 |
| DJVU | ReaderView | ❌ 占位 |

## 核心架构决策

### EPUB：全量渲染
绝大多数书 < 200 章，`dangerouslySetInnerHTML`，不做虚拟章节。

### NCX：DOMParser，禁正则

### TOC 导航：callback ref + Zustand `_readerEl`

### 封面：`userData/covers/{id}.jpg`，JSON 只存 `scroll-cover://local/{id}`

### 豆瓣评分
- 主进程 `douban.ts` 代理请求
- 仅导入 + 手动刷新；返回 `{ ok, rating }` 或 `{ ok: false, error }`
- 公司网可能 `ECONNRESET`，UI 需显示错误而非静默失败

### 阅读主题
- 5 主题 + 3 字体；CSS 变量 `--reader-bg/surface/border/...`
- 阅读模式下 `reader-chrome` 覆盖整窗（顶栏/侧栏/工具栏/正文）

### 全局字号
- `appStore.readerFontSize`（60–200%），EPUB/MOBI/TXT 共用，持久化到 settings JSON

### 启动优化
- preload 提前 `app:bootstrap`
- `bootstrapHydrate.ts` 与 `import('./App')` 并行
- LibraryView 懒加载；vendor 拆包；封面 lazy；V8 code cache

## 已完成功能

- EPUB/TXT/PDF/CBZ/MOBI 阅读器
- foliate-js MOBI、封面落盘、侧栏拖动/折叠
- 启动多轮优化、阅读主题整窗、书架卡片缩小
- 豆瓣评分错误反馈、全局字号持久化

## 待实现

1. DJVU 阅读器
2. CBR 完善（压缩 RAR）
3. MOBI 难例样书回归验证
4. 豆瓣手动输入评分（公司网不可用备选）

## PowerShell

用 `;` 连接命令，不用 `&&`。
