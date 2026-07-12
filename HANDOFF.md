# Handoff — 卷轴 Scroll

> 下个会话先读此文件，快速恢复上下文。

## 当前状态 (2026-07-12)

EPUB/TXT/PDF 三个核心阅读器稳定。MOBI/AZW3 阅读器已集成 Koodo Reader 解析引擎，MOBI6 (PalmDOC) 基本可用，HUFF/CDIC 格式（"权力"等）仍然严重乱码。CBZ 可用，CBR 未实测。

## 启动方式

双击 `Scroll.vbs`（跑 `out/` 构建产物）。
每次改完代码必须 `npx electron-vite build`。

## 关键文件速查

| 文件 | 作用 |
|------|------|
| `src/renderer/src/components/reader/EpubReader.tsx` | EPUB 阅读器，全量渲染 |
| `src/renderer/src/components/reader/TxtReader.tsx` | TXT 阅读器 |
| `src/renderer/src/components/reader/PdfReader.tsx` | PDF 阅读器 |
| `src/renderer/src/components/reader/MobiReader.tsx` | MOBI/AZW3 阅读器 |
| `src/renderer/src/components/reader/ComicReader.tsx` | CBZ/CBR 漫画阅读器 |
| `src/renderer/src/lib/epubParser.ts` | EPUB 解析（JSZip + DOMParser NCX） |
| `src/renderer/src/lib/mobiParser.ts` | MOBI/AZW3 解析（Koodo Reader 引擎移植） |
| `src/renderer/src/lib/comicParser.ts` | CBZ/CBR 解析 |
| `src/renderer/src/lib/txtParser.ts` | TXT 正则分章 |
| `src/renderer/src/stores/appStore.ts` | Zustand 全局状态 |
| `src/renderer/src/App.tsx` | 根组件，路由，TOC 生命周期 |
| `src/main/index.ts` | Electron 主进程 + IPC |

## 架构红线

1. **不做虚拟章节/懒加载** — 全量渲染
2. **NCX 用 DOMParser，禁正则**
3. **兄弟组件通信用 callback ref + Zustand 存 DOM**
4. **TOC href 必须支持 fragment**
5. **进度恢复用 scrollTop 百分比 + 重试**

## MOBI/AZW3 解析详细状态

### 解析引擎来源
移植自 Koodo Reader（`koodo-reader/kookit/src/libs/mobi.js`，GPL v3）。

### 支持的压缩格式
| 压缩类型 | 值 | 处理方式 | 状态 |
|----------|-----|---------|------|
| 无压缩 | 1 | 直接拼接原始字节 | ❌ 不可用 |
| PalmDOC LZ77 | 2 | Koodo 引擎的 `decompressPalmDOC` | ⚠️ 基本可用 |
| HUFF/CDIC | 17480 | 自实现的 `huffUnpackData` | ❌ 严重乱码 |

### 数据处理策略
1. 读取 MOBI header 的 `trailingFlags`（offset 0xF0）
2. 若 `trailingFlags` 有效（非 0xFFFFFFFF 且非 0）→ 逐 record 清理尾部条目后独立解压
3. 若无有效 `trailingFlags` → 拼接所有 record 后一次性解压
4. 解压后：KF8 多文档拆分 + HTML 清理 + `�` 去除

### 已知问题
1. **HUFF/CDIC 解压乱码** — `huffUnpackData` 实现有 bug，输出内容不可读
2. **PalmDOC 偶发 HTML 标签断裂** — `<table>` 变成 `lass="...">`，因解压残留 null 字节
3. **MOBI v7（无压缩格式）不支持** — "掌控习惯"等文件直接乱码
4. **`getUint` 边界问题** — 1 字节 uint 字段（如 `localeRegion`）需特殊处理

## 踩过的坑（MOBI/AZW3 开发日志）

### 坑 1：PalmDOC 算法反复试错
从 PalmDOC LZ77 开始自研实现 → 对照 calibre C 源码修正 → 发现 `0xC0-0xFF` 是空格压缩而非 LZ77 长格式 → 对照 Koodo minified JS 微调 → 始终有边缘乱码。**结论：二进制格式解析不要从零实现，直接移植成熟方案。**

### 坑 2：Koodo 引擎集成
移植后发现 `trailingFlags=0xFFFFFFFF`（很多 AZW3 文件的默认值）被错误解析为 31 个 trailing entries，删除了大量正常数据。**修复：** 0xFFFFFFFF 视为 0。

### 坑 3：`getUint` 对 2 字节字段的崩溃
`getUint` 函数读取 uint32，但 MOBI header 有 2 字节和 1 字节的 uint 字段。**修复：** 根据字段 size 自动选择 `getUint32`/`getUint16`/直接读 byte。

### 坑 4：`resourceStart` 误解
`mobi.resourceStart`（offset 0x6C）是第一张图片的索引，不是文本记录数。正确做法是用 PalmDOC header 的 `numTextRecords`。

### 坑 5：HUFF/CDIC record 搜索
KF8 文件的 HUFF/CDIC 记录在文本记录之后（不在 `firstNonBook + 20` 范围内）。**修复：** 全文件搜索。

## 自测文件
测试书籍目录：`D:\10_Books\05_人文艺术与生活类`（48 本，含 mobi/azw3/epub/pdf）。仅复制用于测试，不得修改或删除原始文件。
