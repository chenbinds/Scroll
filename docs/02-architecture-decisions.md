# 技术决策记录 (ADR)

> 记录项目中的重要技术决策及理由。格式遵循 [ADR](https://adr.github.io/)。

---

## ADR-001: 选择 Electron 而非 Tauri

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

需要选择一个桌面应用框架来构建跨平台（先 Windows）的电子书阅读器。

### 选项

| | Electron | Tauri | Python + Qt |
|---|---|---|---|
| 前端生态 | ✅ 完整 Web 生态 | ✅ 完整 Web 生态 | ❌ 需自绘 |
| 安装包大小 | ~150MB | ~10MB | ~50MB |
| Rust 门槛 | 无 | 需要 | 无 |
| 社区 & 招聘 | ✅ 最大 | ⚠️ 增长中 | ❌ 小 |
| 原生性能 | ⚠️ 一般 | ✅ 好 | ✅ 好 |

### 决策

选择 **Electron**。

### 理由

1. Brandon 是产品经理，不是全栈开发者——Rust 的 Tauri 维护门槛太高
2. Electron 生态最成熟，出问题容易找到答案
3. 安装包大小在这个项目中不是核心约束（电子书本身动辄几十 MB）
4. 后续找人接手容易（React 开发者多）

---

## ADR-002: AI — 仅支持 OpenAI 兼容协议，不用本地模型

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

AI 功能是卷轴的核心差异化。需要选择 AI 接入方式。

### 选项

| | 仅 OpenAI 协议 | 内置 Ollama | 两者都支持 |
|---|---|---|---|
| 安装包大小 | 无影响 | +2GB (模型) | +2GB |
| 用户配置 | 简单（填 API Key） | 需装 Ollama | 复杂 |
| 使用门槛 | 低 | 高 | 很高 |
| 灵活性 | ✅ 任意供应商 | ❌ 仅本地 | ✅ |

### 决策

选择 **仅支持 OpenAI 兼容协议**。

### 理由

1. 2026 年 OpenAI 兼容 API 已是行业标准，所有主流供应商都支持
2. 不绑死任何一家，用户可以自由选择 DeepSeek/OpenAI/通义千问等
3. 不增加安装包体积
4. 本地模型需求可以通过用户自己搭建的兼容端点（如 Ollama + OpenAI API 适配器）满足

---

## ADR-003: 音乐 — 版权合规策略

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

用户希望在阅读时播放背景音乐，但必须注意版权合规。

### 决策

1. **内置预置曲目**全部来自 Pixabay Music（已确认免版权、可商用、无需署名）
2. 预置曲目直链 Pixabay CDN，**不**将音频文件打包进安装包
3. 用户自行添加的 URL、本地文件由用户自行负责版权
4. UI 中明确标注每首曲目的版权来源
5. 在播放列表面板和 README 中展示版权声明

### 风险

- Pixabay CDN 链接可能失效 → 预置曲目播放失败时自动跳过
- 用户可能添加侵权 URL → UI 中展示明确的版权警告

---

## ADR-004: 状态管理 — Zustand 而非 Redux

**日期:** 2026-07-11
**状态:** 已采纳

### 理由

- 卷轴是中等复杂度应用，Redux 的样板代码是过度设计
- Zustand API 极简，TypeScript 支持好
- 包体积 ~2KB vs Redux ~12KB
- 不需要 middleware 即可实现持久化（后续扩展）

---

## ADR-005: 存储 — JSON 文件（MVP）→ SQLite（后续）

**日期:** 2026-07-11 | 更新: 2026-07-11
**状态:** 已采纳（MVP 阶段用 JSON）

### 背景

原计划用 better-sqlite3，但安装时发现：
- better-sqlite3 需要 C++ 编译（node-gyp）
- 当前环境未安装 Visual Studio Build Tools
- Node.js v25.6.1 的预编译二进制不可用

### 决策

**MVP 阶段：JSON 文件存储**

- 使用 `src/main/storage.ts` 中的 `JsonStore` 类
- 数据存储在 Electron `userData/data/` 目录
- 每个 key 对应一个 `.json` 文件
- 零编译依赖，开箱即用

**后续阶段：迁移到 sql.js（WASM）或 better-sqlite3**

- 当标注/书签数据量增大时，JSON 文件查询性能不足
- sql.js 是纯 JS/WASM 的 SQLite，无需编译
- 或者等环境配置好 VS Build Tools 后切回 better-sqlite3

### 影响

- MVP 阶段数据量小（几十本书、几百条标注），JSON 文件完全够用
- 架构上不锁定存储方案，后续切换只需替换 storage.ts 实现

---

## ADR-006: EPUB 渲染 — 全量渲染，不做虚拟章节

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

EPUB 阅读器最初采用"虚拟章节"方案：所有章节在 DOM 里，但仅渲染可见章节，其余用高度估算的占位符。

### 问题

经多轮测试发现该方案有无法修复的缺陷：
1. 占位符高度估算（`html.length/80*28`）完全不反映实际渲染高度
2. 激活章节后 `scrollHeight` 跳变 → scrollbar 抖动 → 级联重渲染
3. 懒激活依赖 scroll 事件，快速拖滚动条必定漏内容
4. TOC 跳转后需要等待章节激活，引入复杂的时序问题

### 决策

**全量渲染所有章节。** 不做任何形式的懒加载或占位符。

### 理由

- 绝大多数 EPUB < 200 章，总 HTML < 5MB
- 浏览器渲染 5MB HTML 约 500ms，远快于虚拟章节的累积开销
- 消除 scrollHeight 跳变、激活逻辑、高度估算等所有相关 bug

---

## ADR-007: TOC 导航 — callback ref + Zustand 传递 DOM 引用

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

TocPanel（侧边栏）需要触发 EpubReader（主内容区）的滚动。两个组件是兄弟，无法直接通信。

### 尝试过的失败方案

1. Zustand 状态 `navigateToHref` → useEffect 监听 → 有时序空洞
2. Zustand 状态 `navigateToSpineIndex` → useEffect → 同上
3. 模块级 ref `epubNavRef` + `useLayoutEffect` → 组件树渲染顺序不确定
4. 模块级 ref + `useCallback`（render 阶段写入） → React 警告

### 决策

EpubReader 使用 **callback ref** 在 React commit 阶段将滚动容器 DOM 元素存入 Zustand（`_readerEl`）。TocPanel 从 Zustand 读取 DOM，直接执行 `querySelector` + `scrollTo`。

### 理由

- callback ref 在 commit 阶段调用，100% 在 paint 前完成
- 不需要函数引用传递，消除所有时序问题
- TocPanel 完全控制导航逻辑，不依赖 EpubReader 的状态

---

## ADR-008: NCX 解析 — DOMParser，禁止正则

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

EPUB NCX 文件中的 `<navPoint>` 可以嵌套（树状目录）。最初使用正则 `<navPoint[^>]*>([\s\S]*?)<\/navPoint>` 解析。

### 问题

正则的非贪婪匹配遇到嵌套 `<navPoint>` 时，遇到第一个 `</navPoint>` 就停止，导致子节点被吞掉。DocBox 显示树状目录，我们的显示为平铺列表。

### 决策

使用 `new DOMParser().parseFromString(xml, 'text/xml')` + 递归 `querySelectorAll(':scope > navPoint')`。

### 理由

- DOMParser 是浏览器原生 API，正确处理嵌套 XML
- 递归解析自然保留树状结构
- 代码更短、更可读

---

## ADR-009: Fragment 锚点导航

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

NCX 子目录的 `src` 常带 fragment（如 `chapter.xhtml#section1`），父子目录可能指向同一章的不同位置。不支持 fragment 则子目录点击和父目录跳到同一处。

### 决策

导航时从 `href` 提取 `#fragment`，在章节 DOM 内用 `querySelector('#' + fragment)` 定位。有 fragment 时用 `scrollIntoView({ block: 'center' })` 居中显示（确保标题可见）。无 fragment 时用 `block: 'start'`。

---

## ADR-010: 进度恢复 — scrollTop 百分比 + 章节 fallback

**日期:** 2026-07-11
**状态:** 已采纳

### 背景

`scrollIntoView` 在嵌套 DOM 中行为不一致。仅靠章节索引恢复只能定位到章节开头。

### 决策

1. 保存两个值：`chapterIndex`（章节）和 `progress`（整体百分比）
2. 恢复时优先用百分比：`scrollTop = scrollHeight * progress / 100`
3. 百分比不可用时 fallback 到章节索引
4. `setTimeout` 重试（最多 10 次，间隔 200ms）应对 DOM 延迟布局

