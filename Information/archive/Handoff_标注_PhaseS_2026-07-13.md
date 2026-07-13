# Handoff：阅读标注 Phase S（稳定收口）

> 日期：2026-07-13  
> 计划：`标注功能全盘设计`（离开 UX=1A React 弹窗）  
> **本阶段验收通过前，不要正式验收 / 继续排期外推进 P3/P4。**

## Phase S 目标（已实现，待人工验收）

1. **统一离开提示**：书架 / Esc / 窗口 X → 同一 `UnsavedAnnotationsDialog`
2. **曲线 + 手动保存 / 重载**可靠，作为后续地基
3. 红线未破：不改 EPUB 正文 DOM；视口级兄弟 canvas；独立存储；无原生 MessageBox 双轨

## 状态

| 能力 | Phase S | 说明 |
|------|---------|------|
| 顶栏画笔 + 曲线绘制 | ✅ | 验收重点 |
| 手动保存 + dirty | ✅ | |
| 离开提示统一 React 弹窗 | ✅ | `requestLeave` → 弹窗 → `confirmClose` / `cancelClose` |
| 窗口 X 点一次出弹窗 | ✅ | main `close` preventDefault + `app:close-requested` |
| TOC / 字号后坐标 | ✅ | 归一化 0~1 |
| 8 图形 / 橡皮擦 / 标记 | 代码已有 | **非正式验收**；先前会话超前实现，Phase S 过关后再验 |

## 架构红线（勿破）

1. **不改 EPUB 正文 DOM**；`AnnotationOverlay` / `HighlightLayer` 与 `reader-scroll` 为兄弟层。
2. Canvas **仅视口大小**；坐标相对文档归一化 0~1。
3. 标注存 `settings_annotations_{bookId}.json`，不进 books。
4. **一条离开通道**：`requestLeave` → React 弹窗 → `confirmClose` / `cancelClose`。禁止再加原生 MessageBox。

## 关键文件

```
src/renderer/src/stores/annotationStore.ts
src/renderer/src/lib/annotationTypes.ts
src/renderer/src/lib/annotationDraw.ts
src/renderer/src/lib/annotationStorage.ts
src/renderer/src/components/reader/annotation/
  AnnotationToolbar.tsx
  BrushSettingsPanel.tsx
  AnnotationOverlay.tsx
  UnsavedAnnotationsDialog.tsx
src/main/index.ts          # close → app:close-requested；confirm/cancel-close
src/preload/index.ts
src/renderer/src/App.tsx   # onCloseRequested + Esc + 弹窗
```

## 人工验收清单（Phase S）

- [ ] 打开 EPUB → 画笔 → 画曲线 → 滚轮可滚 → 保存 → 完全退出重开仍在
- [ ] 未保存 → 返回书架 / Esc / 窗口 X → **同一样式**弹窗 → 保存 / 不保存 / 取消正确
- [ ] 窗口 X **点一次**即出弹窗（不需点两次）
- [ ] TOC 跳转、改字号后标注不错位；正文不空白
- [ ] `src` 内无 `showMessageBox` 标注退出路径

## 验证命令

```
cd D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll; npx electron-vite build
```

preload/main 有变更时需完全退出后重启（不要只热重载）。

## 下一窗口（Phase S 验收通过后）

按计划做 **P3**（8 图形 + 橡皮擦）正式验收，再 **P4**（选区高亮）。  
启动提示词见计划文件 §6。
