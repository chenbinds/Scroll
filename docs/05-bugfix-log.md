# Bug 修复日志

> 记录项目运行过程中发现的 Bug 和修复方案。

---

## 2026-07-11 — 首批运行时 Bug 修复

### Bug 1: SettingsDialog 点击后黑屏，没有任何内容

**现象：** 点击右上角齿轮图标，弹出的设置对话框一片漆黑，看不到任何表单。

**根因：** `SettingsDialog.tsx` 第 1 行 import 缺少 `Sparkles` 图标：
```tsx
import { X, Eye, EyeOff, Save, Trash2, Globe, Key, Cpu } from 'lucide-react'
//                                                          ^^^^ 缺少 Sparkles
```
文件底部的 `SparklesIcon` 组件使用了未导入的 `<Sparkles>`，导致 React 渲染时抛出 `ReferenceError: Sparkles is not defined`，整个 SettingsDialog 组件崩溃，只显示黑色遮罩层。

**修复：** 添加 `Sparkles` 到 import：
```tsx
import { X, Eye, EyeOff, Save, Trash2, Globe, Key, Cpu, Sparkles } from 'lucide-react'
```

**教训：** 使用 lucide-react 图标后，务必检查每个图标是否都在 import 中声明。

---

### Bug 2: 点击"导入书籍"按钮没反应

**现象：** 书架空状态或已导入书籍后，点击"导入"按钮完全无响应。

**根因：** `package.json` 中多了 `"type": "module"`。这导致 electron-vite 将 preload 脚本编译为 `out/preload/index.mjs`（而非 `index.js`），但主进程代码中引用的是：
```ts
preload: join(__dirname, '../preload/index.js')  // 找不到 .mjs 文件！
```
preload 加载失败 → `window.scrollAPI` 为 `undefined` → `window.scrollAPI.openBookDialog()` 抛出 `TypeError` → async onClick 中静默吞掉错误。

**修复：**
1. 移除 `package.json` 中的 `"type": "module"`
2. 将 `postcss.config.js` 从 ES Module (`export default`) 改为 CommonJS (`module.exports`)

---

### Bug 3: 音乐无法播放

**现象：** 打开音乐播放列表，点击预设曲目无声音。

**根因：** `musicStore.ts` 中的预置 Pixabay CDN URL 全部是虚构的（编造的假链接），例如：
```
https://cdn.pixabay.com/audio/2023/09/07/audio_b6d5a1f0a1.mp3
```
这些 URL 在实际的 Pixabay CDN 上不存在，全部返回 404。

**修复：**
1. 删除所有虚构的 Pixabay URL 预置曲目
2. 新建 `src/renderer/src/lib/audioGenerator.ts` — 基于 Web Audio API 的氛围音生成器
3. 4 个内置生成器：White Noise / Brown Noise / Soft Pad / Rain Sounds
4. MusicTrack 新增 `source: 'generator'` 类型
5. MusicPlayer 重构为三模式播放：
   - `generator` → Web Audio API 实时生成（100% 免版权，离线可用）
   - `url` → HTML5 Audio 网络流媒体
   - `local` → HTML5 Audio file:// 本地文件
6. 播放列表面板中 generator 曲目标注 "Built-in" 标签

---

### Bug 4: LibraryView 中 Book 图标 import 位置不当

**现象：** 可能在某些构建配置下导致 ReferenceError。

**根因：** `Book` 图标 import 写在文件最底部（JSX 代码之后）：
```tsx
export default function LibraryView() { ... }

// 图标导入
import { Book } from 'lucide-react'  // ← 第 92 行，在组件定义之后
```

**修复：** 将 `Book` 移到文件顶部与其他 lucide-react 图标合并 import。

---

### Bug 5: bat 文件双击后前几行乱码

**现象：**
```
'/d' 不是内部或外部命令
'cho' 不是内部或外部命令
```

**根因：** Write 工具保存文件时添加了 UTF-8 BOM（3 个不可见字节 `EF BB BF`）。cmd.exe 读取时将 BOM 当作字符处理，导致：
- `@echo off` → 前 3 字节被 BOM 覆盖 → `cho off`
- `cd /d` → `d /d`

**修复：** 用 Bash `printf` 写入 bat 文件（纯 ASCII，无 BOM）：
```bash
printf '@echo off\r\ncd /d "%%~dp0"\r\n...' > file.bat
```

**全局规则更新：** 写入 `~/.claude/memory/golden-rules-bat-files.md`，明确 bat 文件必须用 printf 写入，不能用 Write 工具。

---

## 2026-07-11 — 阅读器核心功能修复（4 项，第二轮）

> 参考了 koodo-reader 的实现思路：用 spine index 做精确导航，而非 DOM href 字符串模糊匹配。

### Bug 6 (第二轮): 点击目录无法跳转到对应章节

**根因深入分析：**
- 原来的方案依赖 `querySelector('[data-href="..."]')` + 文件名模糊匹配来找 DOM 元素
- NCX TOC 路径和 manifest spine 路径的解析基准目录不同（一个相对 NCX，一个相对 OPF），即使都正确解析也会出现差异
- koodo-reader 的做法：在解析阶段就把每个 TOC item 映射到 spine 数组的 index，跳转时直接按 index 找 DOM（`[data-chapter="{index}"]`）

**修复（重写）：**
1. `epubParser.ts`:
   - `TocItem` 新增 `spineIndex: number` 字段
   - 解析完 spine + TOC 后，对每个 TOC item 按 href（去 fragment）与 spine href 做精确匹配，再降级到文件名匹配，填入正确的 spineIndex
   - `parseNcx()` 仍然用 NCX 目录解析相对路径
2. `EpubReader.tsx`: TOC 导航改为：
   - 从 store 中按 href 找到对应的 TocItem → 取其 `spineIndex`
   - `setRenderedChapters` 激活目标章节及前后 3 章
   - 100ms 后 scrollIntoView 到 `[data-chapter="{index}"]`
3. `TocPanel.tsx`: 无需改动，仍传 `href`，匹配逻辑在 EpubReader 的 useEffect 中完成

---

### Bug 7 (第二轮): 阅读进度无法记录

**根因深入分析：**
- 纯百分比进度对虚拟渲染不友好：进度值依赖 `scrollHeight`，而虚拟渲染下 `scrollHeight` 随章节激活不断变化
- koodo-reader 的做法：记录 **chapterIndex**（spine 位置），下次打开直接渲染目标章节附近的内容

**修复（重写）：**
1. `EpubReader.tsx`:
   - `onProgress` 回调签名改为 `(chapterIndex, chapterCount, percent)` — 同时上报当前章节索引
   - 进度恢复接收 `initialChapterIndex`（而非 percent）：
     - 首次渲染时，激活 `initialChapterIndex +/- 3` 范围内的章节
     - 轮询（20次×200ms）等待目标章节 DOM 就位后 `scrollIntoView`
   - 内部用 `hasRestoredRef` 确保只恢复一次
2. `App.tsx`:
   - EPUB `onProgress` 中将 chapterIndex 存入 `currentPage` 字段（复用为章节索引）
   - 打开书籍时传 `initialChapterIndex={currentBook.currentPage || 0}`

---

### Bug 8 (第二轮): 点击目录后页面非常卡

**根因深入分析：**
- 每个 ChapterPlaceholder 独立创建 IntersectionObserver → 200 章 = 200 Observer
- smooth scrollIntoView 产生大量 scroll 事件 → 所有 Observer 同时回调 → React 级联重渲染
- koodo-reader 使用 epub.js 的 iframe 隔离，天然不存在此问题

**修复（重写）：**
1. `ChapterPlaceholder`:
   - Observer 的 `rootMargin` 扩大到 800px（更早激活，减少碰撞）
   - 加 `activatedRef` 防止同一 placeholder 重复激活
   - 移除 `animate-pulse`（持续的 CSS 动画消耗 GPU）
   - 用固定 `height` 替代 `minHeight`，减少 layout thrashing
2. `ChapterList` scroll handler:
   - 新增 150ms 节流（`lastCheck`），减少 rAF 回调频率
   - 保留 1.5x viewport buffer

---

### Bug 9: 书签功能无效（第一轮修复保留）

**修复确认：**
- 书签持久化：App.tsx 启动加载 + 变更时自动保存
- 自动标签：`"HH:mm - X%"` 格式
- 点击导航：通过 `navigateToPercent` → EpubReader/TxtReader 滚动到百分比位置
- 删除按钮：`stopPropagation` 防误触
