# Handoff — 卷轴 Scroll

> 最新交接：`Information/Handoff_新窗口继续_2026-07-13.md`  
> 标注细节：`Information/Handoff_标注_2026-07-13.md`  
> 待办清单：`TODO.md`  
> 历史文档：`Information/archive/`

## 当前状态 (2026-07-13)

EPUB / TXT / PDF / CBZ / MOBI(AZW3) 阅读器可用。  
**阅读标注**：EPUB + MOBI/AZW/AZW3 全套；PDF 画笔/橡皮（标记因 canvas 暂禁用）。  
音乐 / AI 有可用骨架，细节见 `TODO.md`。

## 启动方式

| 用途 | 方式 |
|------|------|
| 日常 | 双击 `Scroll.vbs`（优先 `release/Scroll.exe`，否则 `out/` + electron） |
| 构建 | `rebuild.bat` 或 `npx electron-vite build` |
| 打包 | `build.bat` → `release/Scroll.exe`（启动更快，推荐） |
| 开发 | `start.bat`（慢，调试用） |
| 首次安装 | `install.bat`（仅新机） |

**勿用：** 任何 `*calibre*.bat`（已删除；MOBI 走 foliate-js）。

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/main/index.ts` | 主进程 IPC、bootstrap、窗口关闭 → React 离开弹窗 |
| `src/main/douban.ts` | 豆瓣搜索（结构化错误） |
| `src/main/covers.ts` | 封面落盘 + `scroll-cover://` |
| `src/preload/index.ts` | preload 提前 bootstrap；confirm/cancel-close |
| `src/renderer/src/bootstrapHydrate.ts` | React 渲染前灌入 Zustand |
| `src/renderer/src/App.tsx` | 路由、离开弹窗、懒加载 |
| `src/renderer/src/stores/annotationStore.ts` | 标注状态 + `requestLeave` |
| `src/renderer/src/stores/appStore.ts` | 全局状态（含 `readerFontSize`） |
| `src/renderer/src/components/reader/annotation/` | 标注 UI / Overlay / 离开弹窗 |
| `src/renderer/src/lib/mobiParser.ts` | foliate-js MOBI 封装 |
| `src/renderer/src/lib/readingTheme.ts` | 阅读主题 + 整窗 CSS 变量 |

## 架构红线

1. **EPUB/MOBI 全量渲染**，不做虚拟章节
2. **NCX 用 DOMParser**，禁正则
3. **MOBI 用 foliate-js**，不要自研、不要 Calibre
4. **封面不进 JSON**，只存 `scroll-cover://local/{bookId}`
5. **豆瓣**：导入拉一次 + 手动刷新；禁止启动批量请求
6. **TOC 导航**：callback ref + Zustand `_readerEl`
7. **标注**：不改正文 DOM；视口兄弟 canvas；独立 `annotations_{bookId}`；离开仅 React 弹窗一条通道

## 文档地图

| 路径 | 内容 |
|------|------|
| `TODO.md` | 待完成 / 待验收清单 |
| `CLAUDE.md` | 项目级 Agent 指令 |
| `Information/Handoff_标注_2026-07-13.md` | 标注功能现状与红线 |
| `Information/archive/` | 过期 handoff 与调研草稿 |
| `docs/` | 产品 / 架构 / 音乐规格 / 开发日志 |

## 自测书籍

`D:\10_Books\05_人文艺术与生活类`（只读，勿改原文件）
