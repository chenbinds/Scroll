# Handoff — 卷轴 Scroll

> 最新交接：`Information/Handoff_新窗口继续_2026-07-13.md`  
> **音乐（下一窗口）：** `Information/Handoff_音乐_2026-07-13.md`  
> 标注细节：`Information/Handoff_标注_2026-07-13.md`  
> 待办清单：`TODO.md`

## 当前状态 (2026-07-13 晚)

- **阅读**：EPUB / TXT / PDF / CBZ / MOBI(AZW3) 可用
- **标注**：EPUB/MOBI/TXT 全套；PDF/CBZ 画笔；侧栏列表 + 书签按书
- **AI**：SSE 流式、按书会话、选区/标注提问、设置页连通性测试
- **豆瓣**：自动 + Shift 手动评分；封面刷新
- **书架**：按 `lastReadAt` 倒序
- **音乐**：骨架可用，**P3 待打磨**（见音乐 handoff）

## 启动方式

| 用途 | 方式 |
|------|------|
| 日常 | `Scroll.vbs`（优先 `release/Scroll.exe`） |
| 构建 | `rebuild.bat` 或 `npx electron-vite build` |
| 打包 | `build.bat` → `release/Scroll.exe` |
| 开发 | `start.bat` |

## 关键文件

| 域 | 路径 |
|----|------|
| 标注 | `components/reader/annotation/`、`stores/annotationStore.ts` |
| AI | `components/ai/AiPanel.tsx`、`lib/aiService.ts`、`lib/aiSessionStorage.ts` |
| 音乐 | `components/music/MusicPlayer.tsx`、`stores/musicStore.ts`、`lib/audioGenerator.ts` |
| 书架 | `components/library/`、`stores/appStore.ts`（`sortBooksByRecent`） |
| 主进程 | `src/main/index.ts`（AI 流式、storage、bootstrap） |

## 架构红线

1. MOBI → **foliate-js**；禁止 Calibre
2. 标注：视口 canvas 兄弟层；`annotations_{bookId}`
3. 离开：仅 `requestLeave` → React 弹窗
4. 封面：`scroll-cover://`；豆瓣导入 + 手动刷新

## 自测书籍

`D:\10_Books\05_人文艺术与生活类`（只读）
