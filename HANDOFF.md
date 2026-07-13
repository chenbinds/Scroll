# Handoff — 卷轴 Scroll

> **最新：** [`Information/Handoff_2026-07-14.md`](Information/Handoff_2026-07-14.md)（2026-07-14）  
> 标注红线：[`Information/Handoff_标注_2026-07-13.md`](Information/Handoff_标注_2026-07-13.md)  
> 音乐（P3 已完成）：[`Information/Handoff_音乐_2026-07-13.md`](Information/Handoff_音乐_2026-07-13.md)  
> 待办：[`TODO.md`](TODO.md)

## 当前状态 (2026-07-14)

- **阅读**：EPUB / TXT / PDF / CBZ / MOBI(AZW3) 可用
- **标注**：EPUB/MOBI/TXT 全套；PDF/CBZ 画笔；侧栏列表 + 书签按书
- **AI**：SSE 流式、按书会话、选区/标注提问、设置页连通性测试
- **豆瓣**：自动 + 手动评分弹窗；封面刷新
- **书架**：按 `lastReadAt` 倒序；Z-Library 外链（`zlib.ch`）
- **音乐**：P3 完成（持久化、添加曲目弹窗、阅读快捷键冲突）
- **打包**：`pack.bat` → `dist/Scroll-{ver}-win-x64.zip`

## 启动方式

| 用途 | 方式 |
|------|------|
| 开发日常 | `Scroll.vbs`（优先 `release/Scroll.exe`） |
| 仅构建 | `rebuild.bat` 或 `npx electron-vite build` |
| **分发他人** | **`pack.bat`**（见 `docs/05-packaging.md`） |
| 开发 | `start.bat` |

## 关键文件

| 域 | 路径 |
|----|------|
| 标注 | `components/reader/annotation/`、`stores/annotationStore.ts` |
| AI | `components/ai/AiPanel.tsx`、`lib/aiService.ts`、`lib/aiSessionStorage.ts` |
| 音乐 | `MusicPlayer.tsx`、`musicStore.ts`、`musicStorage.ts`、`audioGenerator.ts` |
| 书架 | `library/LibraryView.tsx`、`BookCard.tsx` |
| 打包 | `pack.bat`、`scripts/pack.ps1`、`scripts/pack-release.ps1`、`electron-builder.yml` |
| 主进程 | `src/main/index.ts`（storage、bootstrap、openExternal、douban） |

## 架构红线

1. MOBI → **foliate-js**；禁止 Calibre
2. 标注：视口 canvas 兄弟层；`annotations_{bookId}`
3. 离开：仅 `requestLeave` → React 弹窗
4. 封面：`scroll-cover://`；豆瓣导入 + 手动刷新

## 自测书籍

`D:\10_Books\05_人文艺术与生活类`（只读）
