# Handoff — 卷轴 Scroll

> **最新：** [`Information/Handoff_2026-07-14.md`](Information/Handoff_2026-07-14.md)（2026-07-14 晚）  
> 标注红线：[`Information/Handoff_标注_2026-07-13.md`](Information/Handoff_标注_2026-07-13.md)  
> 音乐（P3 已完成）：[`Information/Handoff_音乐_2026-07-13.md`](Information/Handoff_音乐_2026-07-13.md)  
> 待办：[`TODO.md`](TODO.md)

## 当前状态 (2026-07-14 晚)

- **Git**：`master` @ `e49202e`，已 push `origin`（https://github.com/chenbinds/Scroll.git）
- **阅读**：EPUB / TXT / PDF / CBZ / MOBI；段首缩进；排版 + 沉浸 + 查义
- **标注**：全套 + 导出/导入 + 侧栏跳转（字号自适应高亮）
- **搜索 / 锚点进度**：P7 已完成（PDF 搜索二期）
- **打包 / P6**：`pack.bat`；`smoke-check.bat`；`docs/06-troubleshooting.md`
- **下一优先**：`TODO.md` —— **P0 人工验收**；P2 有样书再做

## 启动方式

| 用途 | 方式 |
|------|------|
| 开发日常 | `Scroll.vbs`（`out/` 新于 `release\Scroll.exe` 时用 `out/`） |
| 仅构建 | `rebuild.bat` 或 `npx electron-vite build` |
| **分发他人** | **`pack.bat`**（见 `docs/05-packaging.md`） |
| 发布冒烟 | **`smoke-check.bat`** |
| 开发 | `start.bat` |

## 关键文件

| 域 | 路径 |
|----|------|
| 标注 | `components/reader/annotation/`、`stores/annotationStore.ts`、`lib/jumpToAnnotation.ts`、`lib/annotationExport.ts` |
| 搜索 / 锚点 | `lib/bookSearch.ts`、`lib/readingAnchor.ts`、`lib/useAnchorLayoutPin.ts` |
| 查义 / 排版 | `SelectionLookup.tsx`、`TypographyPanel.tsx` |
| AI | `components/ai/AiPanel.tsx`、`lib/aiService.ts` |
| 音乐 | `MusicPlayer.tsx`、`musicStore.ts`、`musicStorage.ts` |
| 打包 / 冒烟 | `pack.bat`、`scripts/pack.ps1`、`smoke-check.bat`、`scripts/smoke-check.ps1` |
| 主进程 | `src/main/index.ts` |

## 架构红线

1. MOBI → **foliate-js**；禁止 Calibre
2. 标注：视口 canvas 兄弟层；`annotations_{bookId}`；离开仅 `requestLeave`
3. 查义选区上限 80 字（用户确认保留）
4. `release.bak-20260713/` 勿入 git

## 自测书籍

`D:\10_Books\05_人文艺术与生活类`（只读）
