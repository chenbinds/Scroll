# Handoff — 卷轴 Scroll

> **最新：** [`Information/Handoff_2026-07-17.md`](Information/Handoff_2026-07-17.md)（2026-07-17）  
> 前序：[`Information/Handoff_2026-07-14.md`](Information/Handoff_2026-07-14.md)  
> 标注红线：[`Information/Handoff_标注_2026-07-13.md`](Information/Handoff_标注_2026-07-13.md)  
> 音乐（P3 已完成）：[`Information/Handoff_音乐_2026-07-13.md`](Information/Handoff_音乐_2026-07-13.md)  
> 待办：[`TODO.md`](TODO.md)

## 当前状态 (2026-07-17)

- **Git**：`master` @ `30b6886`，已 push `origin`（https://github.com/chenbinds/Scroll.git）
- **阅读**：EPUB / TXT / PDF / CBZ / MOBI；正文内链不白屏
- **书架**：导入进 `UserData/books/`；缺失可重定位
- **数据**：项目根 `UserData/`；便携包 exe 旁 `UserData/`
- **打包**：文件夹便携 `pack.bat`；冒烟 `smoke-check.bat`
- **下一优先**：`TODO.md` —— **P0 人工验收**；P2 有样书再做

## 启动方式

| 用途 | 方式 |
|------|------|
| 开发日常 | `Scroll.vbs`（优先 `electron + out/`） |
| 仅构建 | `rebuild.bat` 或 `npx electron-vite build` |
| **分发他人** | **`pack.bat`**（见 `docs/05-packaging.md`） |
| 发布冒烟 | **`smoke-check.bat`** |
| 开发 | `start.bat` |

## 关键文件

| 域 | 路径 |
|----|------|
| 数据/便携 | `src/main/portableData.ts`、`src/main/bookFiles.ts` |
| 正文链接 | `lib/readerLinkNavigation.ts` |
| 标注 | `components/reader/annotation/`、`stores/annotationStore.ts` |
| 搜索 / 锚点 | `lib/bookSearch.ts`、`lib/readingAnchor.ts` |
| 书架 | `components/library/LibraryView.tsx` |
| 打包 / 冒烟 | `pack.bat`、`scripts/pack.ps1`、`smoke-check.bat` |

## 架构红线

1. MOBI → **foliate-js**；禁止 Calibre
2. 标注：视口 canvas 兄弟层；离开仅 `requestLeave`
3. 查义选区上限 2000 字
4. `release.bak-20260713/` 勿入 git；`UserData/` 勿入 git

## 自测书籍

`D:\10_Books\05_人文艺术与生活类`（只读）
