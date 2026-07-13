# Handoff — 卷轴 Scroll

> 最新详细 handoff 见 `Information/Handoff_foliate启动优化_2026-07-13.md`。本文件为快速索引。

## 当前状态 (2026-07-13)

EPUB / TXT / PDF / CBZ / MOBI(AZW3) 阅读器可用。MOBI 经 **foliate-js** 解析（与 Koodo 同源），已废弃自研/Calibre 方案。启动经多轮优化；阅读主题覆盖整窗；豆瓣评分在公司网被防火墙拦截（UI 有错误提示）。

## 启动方式

| 用途 | 方式 |
|------|------|
| 日常 | 双击 `Scroll.vbs`（优先 `release/Scroll.exe`，否则 `out/` + electron） |
| 构建 | `rebuild.bat` 或 `npx electron-vite build` |
| 打包 | `build.bat` → `release/Scroll.exe`（启动更快，推荐） |
| 开发 | `start.bat`（慢，调试用） |

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/main/index.ts` | 主进程 IPC、bootstrap、窗口 |
| `src/main/douban.ts` | 豆瓣搜索（结构化错误） |
| `src/main/covers.ts` | 封面落盘 + `scroll-cover://` |
| `src/preload/index.ts` | preload 提前 bootstrap |
| `src/renderer/src/bootstrapHydrate.ts` | React 渲染前灌入 Zustand |
| `src/renderer/src/App.tsx` | 路由、持久化、懒加载 |
| `src/renderer/src/stores/appStore.ts` | 全局状态（含 `readerFontSize`） |
| `src/renderer/src/lib/mobiParser.ts` | foliate-js MOBI 封装 |
| `src/renderer/src/lib/readingTheme.ts` | 阅读主题 + 整窗 CSS 变量 |

## 架构红线

1. **EPUB/MOBI 全量渲染**，不做虚拟章节
2. **NCX 用 DOMParser**，禁正则
3. **MOBI 用 foliate-js**，不要自研、不要 Calibre
4. **封面不进 JSON**，只存 `scroll-cover://local/{bookId}`
5. **豆瓣**：导入拉一次 + 手动刷新；禁止启动批量请求
6. **TOC 导航**：callback ref + Zustand `_readerEl`

## 待办 backlog

| 项 | 优先级 |
|----|--------|
| MOBI 难例样书回归（HUFF/CDIC 等） | 验收 |
| CBR 实测与压缩 RAR 支持 | 低 |
| DJVU 阅读器 | 低 |
| 豆瓣手动输入评分（公司网不可用时的备选） | 低 |
| Defender 排除 / 日常用 `release/Scroll.exe` | 环境 |

## 自测书籍

`D:\10_Books\05_人文艺术与生活类`（只读，勿改原文件）
