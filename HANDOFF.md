# Handoff — 卷轴 Scroll

> 下个会话先读此文件，快速恢复上下文。

## 当前状态

EPUB/TXT/PDF 三个核心阅读器已稳定，TOC 导航、进度恢复、书签三大 bug 已修复。

## 启动方式

双击 `Scroll.vbs`（跑 `out/` 构建产物）。

每次改完代码后必须 `npx electron-vite build` 才能生效。

## 关键文件速查

| 文件 | 作用 |
|------|------|
| `src/renderer/src/components/reader/EpubReader.tsx` | EPUB 阅读器，全量渲染，~190 行 |
| `src/renderer/src/components/reader/TxtReader.tsx` | TXT 阅读器 |
| `src/renderer/src/components/reader/PdfReader.tsx` | PDF 阅读器（不动） |
| `src/renderer/src/lib/epubParser.ts` | EPUB 解析：JSZip + DOMParser NCX |
| `src/renderer/src/lib/txtParser.ts` | TXT 正则分章 |
| `src/renderer/src/stores/appStore.ts` | Zustand 全局状态 |
| `src/renderer/src/App.tsx` | 根组件，路由，TOC 生命周期 |
| `src/renderer/src/components/layout/TocPanel.tsx` | 目录面板（递归树状渲染） |
| `src/renderer/src/components/layout/BookmarkPanel.tsx` | 书签面板 |
| `src/main/index.ts` | Electron 主进程 + IPC |
| `src/main/storage.ts` | JSON 文件存储 |

## 架构红线（不可违背）

1. **不做虚拟章节/懒加载。** 所有内容全量渲染。不要用 placeholder、IntersectionObserver、scroll-based activation。
2. **NCX 用 DOMParser，禁正则。** `new DOMParser().parseFromString(xml)` + `:scope > navPoint` 递归。
3. **兄弟组件通信用 callback ref + Zustand 存 DOM。** 不要用 useEffect/useLayoutEffect/模块 ref 传函数。
4. **TOC href 必须支持 fragment。** 从 href 提取 `#xxx`，在章节 DOM 内 `querySelector` 定位。
5. **进度恢复用 scrollTop 百分比 + 章节 fallback + 重试。**

## 已实现功能

- EPUB 阅读：全量渲染、树状 TOC（fragment 跳转）、进度恢复
- TXT 阅读：全量渲染、正则分章 TOC、进度恢复
- PDF 阅读：pdf.js canvas
- 书签：添加/删除/持久化/点击跳转
- 书架：导入/展示/进度条/删除
- AI 聊天面板（OpenAI 兼容）
- 音乐播放器（Web Audio API）
- 暗色/亮色主题
- 中英文 i18n

## 下一步（按优先级）

1. **阅读主题系统** — 5 套（亮/纸/护眼/暗/自然）+ 5 种字体（宋/黑/楷/系统/等宽），字体打包进 `resources/fonts/`
2. **书籍封面提取** — EPUB 内嵌图片→base64 存 storage，PDF 首页缩略图，TXT 自动生成
3. **豆瓣评分集成** — 首次导入询问，全手动刷新 + "全部刷新"按钮，精确匹配/其他版本（橙色）/手动输入
4. **MOBI/AZW3 阅读引擎** — 自研纯 JS 解析器
5. **CBZ/CBR 漫画**

详细设计见 `docs/06-refactor-design.md` 已删除，内容整合进了 `CLAUDE.md`。

## 今日踩过的坑

| # | 坑 | 结论 |
|---|-----|------|
| 1 | 虚拟章节渲染 | 全量渲染，电子书不大 |
| 2 | NCX 正则解析 | DOMParser 递归 |
| 3 | 模块 ref 通信 | callback ref + Zustand DOM |
| 4 | Fragment 未支持 | 提取 #fragment + querySelector |
| 5 | scrollIntoView 不可靠 | scrollTop 百分比计算 |
| 6 | useEffect 注册函数 | callback ref 在 commit 阶段 |

详见 `CLAUDE.md`、`docs/02-architecture-decisions.md`、`memory/*.md`。

## Git

```bash
git log --oneline  # 查看提交历史
```

最后提交：`d8ce27e docs: reorganize documentation and finalize bug fixes`
