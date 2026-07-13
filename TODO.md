# 卷轴 Scroll — 待完成清单（TODO）

> 更新日期：2026-07-14  
> 用途：人工验收缺口 + 功能增强 backlog。完成一项请勾选并简短注明。

## P0 — 建议优先验收 / 收口

- [ ] **标注人工抽验（EPUB）**：8 图形、橡皮、标记+笔记、保存/重载、离开弹窗（书架/Esc/窗口 X）
- [ ] **标注抽验（MOBI / AZW3）**：画笔+标记+保存；与 EPUB 同套交互
- [ ] **标注抽验（PDF）**：画笔/橡皮/缩放后不错位；确认「标记」禁用符合预期
- [ ] **日常启动**：`rebuild.bat` 后 `Scroll.vbs` 或 `pack.bat` 产出之 `Scroll.exe` 冷启动一轮

## P1 — 标注后续（计划内未做）

- [x] **TXT / MD**：复用 `AnnotationOverlay` + `MarkSelectionHandler`
- [x] **Comic（CBZ/CBR）**：按页 overlay（坐标按页归一化）
- [x] **侧栏「书签 & 标注」**：列出笔画/高亮，点击跳转；与位置书签并存
- [x] **书签按书隔离**：`bookmarksByBook` 按 `bookId` 分桶持久化

## P2 — 阅读格式补齐

- [ ] **DJVU 阅读器**：当前 `ReaderView` 占位
- [ ] **CBR 压缩 RAR**：`comicParser` 目前仅 RAR stored，压缩条目会失败；实测样书
- [ ] **MOBI 难例回归**：HUFF/CDIC 等样书（`D:\10_Books\...`，只读）

## P3 — 音乐功能 ✅ 已完成（2026-07-13 ~ 14）

- [x] **播放列表持久化**（`music_state` IPC）
- [x] **加 URL / 本地文件**交互（弹窗替代 prompt）
- [x] 环境音与本地曲目切换、文档流迷你条
- [x] 迷你播放器与阅读模式冲突（快捷键 / Esc 暂停）

> 交接：`Information/Handoff_音乐_2026-07-13.md`（文首已标完成）

## P4 — AI 功能 ✅ 已完成

- [x] **流式输出**（SSE / chunk）
- [x] **会话持久化**（按书）
- [x] **PDF / Comic 上下文**：页码 + 格式说明注入 system
- [x] **选区提问** / 标注笔记送入 AI
- [x] 设置页：连通性检测、错误提示

## P5 — 豆瓣与其它 ✅ 已完成

- [x] **手动输入评分**（Shift+点击；弹窗输入）
- [x] 导入失败 / 评分失败文案与重试体验
- [x] 封面缺失书的占位与刷新
- [x] **书架 Z-Library 按钮**（系统浏览器打开 `https://zlib.ch`）

## P6 — 工程 / 环境

- [ ] 确认 Defender / 杀软对 `Scroll.exe` 的误报与排除
- [x] 便携包与 `out/` 双路径说明（`Scroll.vbs` / `pack.bat` → `docs/05-packaging.md`）
- [ ] 可选：为标注 / 离开弹窗补最小自动化冒烟（非必须）

---

## 已完成摘要（便于对照，勿再排进开发）

| 域 | 状态 |
|----|------|
| EPUB / TXT / PDF / CBZ / MOBI·AZW3 阅读 | ✅ 可用 |
| 阅读主题整窗 + 全局字号 | ✅ |
| 启动优化（preload bootstrap 等） | ✅ |
| 标注（EPUB/MOBI/AZW3/TXT 全套；PDF/CBZ 画笔） | ✅ |
| 侧栏标注列表 + 书签按书隔离 | ✅ |
| 统一离开弹窗（React） | ✅ |
| AI 流式/持久化/选区/连通性测试 | ✅ |
| 豆瓣手动评分 + 封面刷新 | ✅ |
| 书架按 lastReadAt 倒序 + Z-Library 外链 | ✅ |
| 笔记弹窗 / AI 输入框可调大小 | ✅ |
| 音乐 P3 | ✅ |
| 一键打包 `pack.bat` → dist zip | ✅ |

详细标注红线见：`Information/Handoff_标注_2026-07-13.md`  
项目现状见：`Information/Handoff_2026-07-14.md`
