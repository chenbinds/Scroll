# Scroll 重构设计文档

> 基于前 N 轮修复失败的根因分析，从第一性原理重新设计。

---

## 0. 现状诊断

### 0.1 根因：虚拟章节渲染是一切的罪魁祸首

```
当前 EpubReader 架构:
  spine[] (100章) 
    → 100个 DOM section（全部挂在 DOM 里）
    → 其中 10 个有内容（renderedChapters）
    → 90 个是 ChapterPlaceholder（估算高度: html.length/80*28）
    → scroll 事件触发激活 → 占位符换真实内容 → 高度跳变 → scrollbar 抖动
    → TOC 跳转靠 _navFn（useEffect 注册有时序空洞）
```

**这个架构的三个致命缺陷：**

1. **高度估算永远不准** — `html.length/80*28` 完全不反映实际渲染高度（CSS、图片、表格）
2. **激活不可靠** — 依赖 scroll 事件 + 定时器 fallback，快速拖滚动条必定漏
3. **TOC 有时序空洞** — useEffect 注册函数在 paint 之后，用户点击时可能还没注册

### 0.2 为什么 koodo-reader 不存在这些问题

koodo-reader 用 epub.js，每个章节渲染在**独立 iframe** 内：
- 天然隔离，章节间不互相影响
- epub.js 管理所有导航逻辑（CFI 定位）
- 不需要"虚拟章节"，不需要"激活"

### 0.3 各格式阅读器现状（各自为政）

| 格式 | Reader 组件 | 行数 | 渲染方式 | TOC | 进度 | 状态 |
|------|-----------|------|---------|-----|------|------|
| PDF | PdfReader.tsx | 278 | canvas 懒加载 | ❌ 无 | ✅ cf-idx | ✅ 可用 |
| EPUB | EpubReader.tsx | 345 | 虚拟章节(坏) | ⚠️ 坏 | ⚠️ 不可靠 | ❌ 有bug |
| TXT/MD | TxtReader.tsx | 190 | 全量渲染 | ⚠️ 同样坏 | ⚠️ 不可靠 | ⚠️ 可用 |
| MOBI/AZW3 | ReaderView.tsx | 60 | 占位 | ❌ 无 | ❌ 无 | ❌ 未实现 |
| CBZ/CBR | ReaderView.tsx | 60 | 占位 | ❌ 无 | ❌ 无 | ❌ 未实现 |
| DJVU | ReaderView.tsx | 60 | 占位 | ❌ 无 | ❌ 无 | ❌ 未实现 |

**核心问题：没有共享的阅读器基础设施。每个格式重复造轮子。**

---

## 1. 新架构：统一阅读器框架

### 1.1 核心原则

> **全量渲染，不做懒加载。** 绝大多数电子书 < 200 章，总 HTML < 5MB，浏览器 500ms 内渲染完毕。

```
新原则:
  ✅ 一次解析 → 全量渲染 → 不再改动 DOM 高度 → scroll 自然流畅
  ✅ TOC 跳转 → querySelector → scrollIntoView → 即跳（无时序问题）
  ✅ 所有格式共享同一个滚动容器和进度追踪逻辑
  ❌ 不再有 ChapterPlaceholder
  ❌ 不再有 renderedChapters Set
  ❌ 不再有 scroll-based activation
  ❌ 不再有 IntersectionObserver on chapters
  ❌ 不再有高度估算
```

### 1.2 共享阅读器基础设施

抽取一个 `useReaderEngine` hook，所有格式的阅读器组件共享：

```ts
// 每个格式只需要实现这个接口
interface ReaderAdapter {
  /** 加载并返回渲染内容 */
  load(filePath: string): Promise<RenderResult>
  /** 构建目录 */
  buildToc(result: RenderResult): TocItem[]
  /** 当前阅读位置的语义描述（用于书签和进度恢复） */
  getPosition(container: HTMLElement): ReadingPosition
  /** 跳转到指定位置 */
  goToPosition(container: HTMLElement, pos: ReadingPosition): void
  /** 释放资源 */
  destroy(): void
}

interface RenderResult {
  title: string
  author: string
  /** React 节点 — 直接渲染到滚动容器 */
  content: ReactNode
  /** 当前进度（按格式不同含义不同） */
  initialPosition?: ReadingPosition
}
```

### 1.3 各格式渲染策略

| 格式 | 渲染策略 | 总 DOM 量级 | TOC 来源 |
|------|---------|-----------|---------|
| PDF | pdf.js canvas（保持现状） | N 个 canvas | PDF outline |
| EPUB | 全量 dangerouslySetInnerHTML | ~5MB HTML | NCX/NAV |
| TXT/MD | 全量 `<p>` 标签 | ~2MB text | 正则分章 |
| MOBI/AZW3 | 全量（需要先解析 MOBI→HTML） | ~5MB HTML | MOBI 内置 |
| CBZ/CBR | 全量 `<img>` 标签 | N 个 img | ZIP 文件名 |
| DJVU | pdf.js 或专用库 | N 个 canvas/image | DJVU outline |

---

## 2. TOC 导航：彻底消除时序问题

### 2.1 新方案：render 阶段直接注册

```
之前（有时序空洞）:
  useEffect → _setNavFn(navToChapter)  ← paint 之后才注册
  TocPanel paint → 用户点击 → _navFn 是 null → fallback 丢了

现在（无时序空洞）:
  render 阶段 → useAppStore.getState()._setNavFn(navToChapter)  ← DOM commit 前注册
  TocPanel paint → 用户点击 → _navFn 已存在 → 直接调用
```

### 2.2 导航函数简化

由于全量渲染，导航只是：
```ts
function navToChapter(index: number) {
  const el = contentRef.current?.querySelector(`[data-chapter="${index}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```
不需要 setRenderedChapters、不需要轮询、不需要 rAF+setTimeout。

### 2.3 TOC 生命周期

| 事件 | 动作 |
|------|------|
| 打开有 TOC 的书（EPUB/TXT） | `setToc(toc)` + 注册 `_navFn` |
| 切换到无 TOC 的书（PDF/CBZ） | `setToc([])` + 注销 `_navFn` + 关闭 sidebar |
| 返回书架 | `setToc([])` + 注销 `_navFn` + 关闭 sidebar |

---

## 3. 阅读主题系统

### 3.1 市面产品调研

| 产品 | 主题方案 | 特点 |
|------|---------|------|
| **Koodo Reader** | 4 种预设（白/米黄/灰/黑） | 简单切换，纯背景色变化 |
| **Apple Books** | 6 种（白/米白/棕褐/灰/黑 + 自动） | 渐变背景，暖色调选项 |
| **Kindle** | 3 种（白/棕褐/黑）+ 暖光调节 | 暖光色温可调 |
| **微信读书** | 5 种（白/米黄/护眼绿/羊皮纸/黑） | 纹理背景，护眼主题 |
| **Calibre** | 自定义 CSS | 完全自定义 |

### 3.2 Scroll 方案：4 + 1 主题

```
┌────────────────────────────────────────────┐
│ 主题        背景色      文字色      特点      │
├────────────────────────────────────────────┤
│ 亮色(默认)   #FFFFFF    #1a1a1a    默认      │
│ 类纸         #F5F0E8    #3d3226    暖米黄    │
│ 护眼         #E8F0E8    #2d3a2d    淡绿底    │
│ 暗色         #1a1a1a    #e0e0e0    现有暗色  │
│ 自然         #FAF8F5    #2c2c2c    微暖灰白  │
└────────────────────────────────────────────┘
```

实现方式：CSS 变量 + Tailwind 主题扩展
- `--reader-bg`, `--reader-text`, `--reader-accent` 等 CSS 变量
- 阅读器容器应用主题 class（`theme-paper`, `theme-eye`, `theme-dark`, `theme-nature`）
- 字体大小独立于主题（已有 ± 按钮）

### 3.3 字体系统

```
字体选项:
  系统默认 (system-ui)
  宋体 (Noto Serif SC / SimSun)    ← 类纸风格配套
  黑体 (Noto Sans SC / SimHei)
  楷体 (KaiTi)
  等宽 (JetBrains Mono / Consolas) ← TXT/MD 代码
```

---

## 4. 书籍封面提取

### 4.1 封面来源（参考 Koodo Reader）

| 格式 | 封面提取方式 |
|------|-------------|
| EPUB | 1) OPF `<meta name="cover">` → manifest item → ZIP 内图片 → base64 |
|       | 2) ZIP 内第一个大图片（>50KB） |
|       | 3) 取 cover.jpeg/cover.png 等命名文件 |
| MOBI/AZW3 | moby 解析 → 内嵌封面图片 → base64 |
| PDF | pdf.js → `page.getViewport()` → 第 1 页 → canvas.toDataURL() 缩略图 |
| TXT/MD | 无封面 → 自动生成（格式标签 + 书名首字艺术字） |
| CBZ/CBR | ZIP/RAR 内第一张图片 → base64（缩略） |

### 4.2 实现

- `parseEpub()` 扩展：返回 `coverDataUrl?: string`
- `Book` 接口：新增 `coverDataUrl?: string`
- `BookCard`：`img[src]` 用 data URL 显示
- 封面缓存：存入 storage 避免重复提取

---

## 5. 豆瓣评分集成

### 5.1 匹配策略

```
输入: 书名 + 作者
  ↓
精确匹配: douban.com/search?q=《书名》+作者
  ↓ 找到唯一匹配
  → 获取评分 + 评分人数 + 封面 → 显示
  ↓ 未找到
模糊匹配: douban.com/search?q=书名（不带作者）
  ↓ 找到多个结果 → 选评分人数最多的那个
  → 获取评分 → 用黄色/橙色显示（暗示非精确匹配）
  ↓ 未找到
留空 + 显示手动输入入口
```

### 5.2 数据结构

```ts
interface DoubanRating {
  score: number           // 评分 0-10
  voters: number          // 评分人数
  url: string             // 豆瓣链接
  isExactMatch: boolean   // 精确匹配 vs 其他版本
  matchedBookName: string // 匹配到的书名（可能不同）
  updatedAt: number       // 上次刷新时间戳
}
```

### 5.3 UI 交互

- 书架卡片底部显示评分（豆瓣绿色星星 + 分数）
- 非精确匹配用橙色星星 + "其他版本"标注
- 悬停显示：匹配的书名 + 评分人数 + 豆瓣链接
- 右键菜单：手动刷新 | 手动输入评分
- 设置中可以配置是否显示评分

### 5.4 技术实现

- 通过主进程 HTTP 请求豆瓣搜索（无 API，用 HTML 解析）
- 缓存评分到 storage（按 ISBN/书名+作者为 key）
- 手动刷新仅重新请求该书
- 手动输入直接存本地，点击可清除

---

## 6. 实施计划

### Phase A: 基础重构（修复所有 bug）

1. **重写 EpubReader** — 全量渲染，删除虚拟章节逻辑
2. **重写 TxtReader** — 统一到新的 ReaderAdapter 模式
3. **统一 TOC 导航** — render 阶段注册 `_navFn`
4. **统一进度追踪** — chapterIndex + percent，可靠持久化
5. **删除死代码** — ChapterPlaceholder, ChapterList, useMemo 章节缓存, scroll activation, 高度估算

**预估改动:** 删除 ~200 行，新增 ~150 行

### Phase B: 阅读主题 + 字体

1. CSS 变量系统 + 5 套主题
2. 字体选择器（TopBar 下拉菜单）
3. 主题持久化到 storage

### Phase C: 封面提取

1. EPUB/MOBI 封面解析
2. PDF 第一页缩略图
3. TXT 自动生成
4. BookCard 改造

### Phase D: 豆瓣评分

1. 主进程豆瓣搜索 + HTML 解析
2. 评分缓存 + UI 展示
3. 手动输入/刷新

---

## 7. 确认决策

| # | 问题 | 决策 |
|---|------|------|
| 1 | 封面存储 | 存 storage（base64），不存临时文件 |
| 2 | 豆瓣刷新策略 | 首次导入时弹窗询问是否同步。之后全手动，提供"全部刷新"按钮，后台逐个更新 |
| 3 | 字体 | 打包到应用内（思源宋体 ~15MB），确保跨平台一致性 |
| 4 | MOBI/AZW3 | 一起实现，用纯 JS 解析（调研后可用的库） |
| 5 | PDF reader | 不动，保持现状 |

---

## 8. 详细实施步骤

### 第一步：基础重构（EPUB + TXT 全量渲染 + TOC 修复）

**目标：** 一次性彻底消除所有已知 Bug

**EpubReader 重写要点：**
- 删除：`renderedChapters` / `ChapterPlaceholder` / `ChapterList` / scroll activation / `useMemo` 章节缓存 / 高度估算
- 新增：全量渲染 `epubContent.spine.map(i => <section data-chapter={i} dangerouslySetInnerHTML={...} />)`
- TOC 导航：`useLayoutEffect` 注册（替换 `useEffect`），消除时序空洞
- 进度恢复：全量渲染后直接 `scrollIntoView`，无需轮询

**TxtReader 重写要点：**
- 已有全量渲染，主要是统一 TOC 导航机制
- 统一到同样的 `_navFn` 模式

**App.tsx 调整：**
- TOC 生命周期管理：有 TOC 的书设 TOC，无 TOC 的书清 TOC + 关 sidebar
- 进度持久化：chapterIndex + percent

**改动文件：** `EpubReader.tsx`, `TxtReader.tsx`, `appStore.ts`, `App.tsx`, `TocPanel.tsx`

### 第二步：MOBI/AZW3 阅读引擎

**调研：** npm 上的纯 JS MOBI 解析库
- `mobi-js` — 不存在，需要自行实现
- 方案：手写简化版 MOBI/AZW3 解析器（类似 EPUB 的自研 JSZip 方案）
- MOBI 格式是 PalmDoc DB + HTML 内容，解析逻辑相对直接
- 封面从 MOBI header 的内嵌图片提取

### 第三步：阅读主题 + 字体

- 5 套主题：CSS 变量切换（亮/纸/护眼/暗/自然）
- 5 种字体：系统默认/宋体(Noto Serif SC)/黑体(Noto Sans SC)/楷体/等宽
- Noto Serif SC + Noto Sans SC 打包进 `resources/fonts/`
- 字体通过 `@font-face` 注册，主题通过 CSS class 切换
- 主题 + 字体设置持久化到 storage

### 第四步：书籍封面

- 扩展 `parseEpub()` 返回 `coverDataUrl`
- Book 接口加 `coverDataUrl` 字段
- BookCard 显示封面图片
- 导入时自动提取，存 storage

### 第五步：豆瓣评分

- 主进程新增 IPC handler `douban:search`（类似 `ai:chat` 代理模式）
- 豆瓣搜索页 HTML 解析（非 API，解析搜索结果页）
- 首次导入弹窗："是否同步豆瓣评分？"
- 右键菜单：单本刷新 / 手动输入
- 书架右上角："刷新全部评分"按钮 → 后台队列逐个更新
- 评分缓存到 storage（key: `douban_${书名}_${作者}`）
