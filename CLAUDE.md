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
| 开发日常 | `Scroll.vbs` | 优先 `electron + out/`；数据在项目根 `UserData/` |
| 仅构建 | `rebuild.bat` | 只构建到 `out/` |
| **分发打包** | **`pack.bat`** | 便携 exe + `dist/*.zip`（见 `docs/05-packaging.md`） |
| 兼容入口 | `build.bat` | 转发至 `pack.bat` |
| 开发 | `start.bat` | electron-vite dev |
| 首次安装 | `install.bat` | `npm install`（仅新机/清依赖后） |

**已废弃（勿用）：** `install_calibre.bat` / `setup_calibre.bat` / `copy_calibre.bat` — MOBI 已改 foliate-js，禁止捆绑 Calibre。

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
│       ├── stores/               # appStore, musicStore, annotationStore
│       └── lib/
│           ├── epubParser.ts     # EPUB：JSZip + DOMParser NCX
│           ├── mobiParser.ts     # MOBI：foliate-js 封装
│           ├── annotation*.ts    # 标注类型 / 绘制 / 存储
│           ├── readingTheme.ts   # 阅读主题 + 整窗 CSS 变量
│       └── lib/
│           ├── musicStorage.ts     # 音乐持久化
│           ├── readerShortcuts.ts  # 阅读快捷键守卫
│           └── ...
├── scripts/            # pack.ps1、pack-release.ps1、README.dist.txt
├── tools/offline/      # 可选 builder 离线包（*.7z 不提交）
├── Information/Handoff_2026-07-17.md 为最新
├── docs/               # 含 05-packaging.md、06-troubleshooting.md
├── TODO.md
├── pack.bat            # 一键打包 → dist/*.zip
├── out/                # electron-vite 构建产物（gitignore）
└── release/            # electron-builder 便携文件夹 win-unpacked（gitignore）
```

## MOBI/AZW3

```
MOBI/AZW3 → foliate-js (mobi.js) → MobiReader 全量渲染
```

**禁止**自研二进制解析、**禁止**捆绑 Calibre。旧方案已废弃。

## 各格式状态

| 格式 | 组件 | 状态 |
|------|------|------|
| EPUB | EpubReader | ✅ 含标注全套 |
| TXT/MD | TxtReader | ✅ 阅读 + 标注全套 |
| PDF | PdfReader | ✅ 画笔/橡皮；标记禁用 |
| MOBI/AZW3 | MobiReader | ✅ foliate-js；含标注 |
| CBZ/CBR | ComicReader | ✅ 阅读 + 按页画笔 |
| CBR | ComicReader | ⚠️ 仅 RAR stored，未实测 |
| DJVU | ReaderView | ❌ 占位 |

## 核心架构决策

### EPUB：全量渲染
绝大多数书 < 200 章，`dangerouslySetInnerHTML`，不做虚拟章节。

### NCX：DOMParser，禁正则

### TOC 导航：callback ref + Zustand `_readerEl`

### 封面：项目根 `UserData/covers/{id}.jpg`（开发）或 exe 旁 `UserData/covers/`（真正便携包），JSON 只存 `scroll-cover://local/{id}`

### 豆瓣评分
- 主进程 `douban.ts` 代理请求
- 仅导入 + 手动刷新；返回 `{ ok, rating }` 或 `{ ok: false, error }`
- 公司网可能 `ECONNRESET`，UI 需显示错误而非静默失败

### 阅读主题
- 5 主题 + 3 字体；CSS 变量 `--reader-bg/surface/border/...`
- 阅读模式下 `reader-chrome` 覆盖整窗（顶栏/侧栏/工具栏/正文）

### 全局字号
- `appStore.readerFontSize`（60–200%），EPUB/MOBI/TXT 共用，持久化到 settings JSON

### 标注
- 视口级兄弟 canvas；坐标归一化 0~1；独立 `annotations_{bookId}`
- 离开唯一通道：`requestLeave` → React 弹窗（禁止原生 MessageBox 双轨）
- 详见 `Information/Handoff_标注_2026-07-13.md`

### 启动优化
- preload 提前 `app:bootstrap`
- `bootstrapHydrate.ts` 与 `import('./App')` 并行
- LibraryView 懒加载；vendor 拆包；封面 lazy；V8 code cache

## 已完成功能

- EPUB/TXT/PDF/CBZ/MOBI 阅读器
- foliate-js MOBI、封面落盘、侧栏拖动/折叠
- 启动多轮优化、阅读主题整窗、书架卡片缩小
- 豆瓣评分错误反馈、全局字号持久化
- 阅读标注（EPUB/MOBI/AZW3/TXT；PDF/CBZ 画笔）+ 统一离开弹窗
- AI 流式/会话/选区；豆瓣手动评分；书架按最近打开排序
- 音乐 P3（持久化、弹窗、阅读冲突）；Z-Library 外链；`pack.bat` 分发打包

## 待实现

见根目录 **`TODO.md`**（**下一优先 P0 人工验收**；P7/P6 已完成；P2 格式有样书再做）。

## PowerShell

用 `;` 连接命令，不用 `&&`。

