# Handoff：foliate-js 与启动优化

## 1. 当前状态

卷轴 Scroll 已完成 MOBI/AZW3 → **foliate-js** 迁移、启动优化、封面落盘、豆瓣评分策略调整，以及左右侧栏可拖动改宽。**已 git commit（`1e3ca67`）**。用户侧启动体感仍待复测（应用内 bootstrap ~0.4s，疑杀软/冷启动）。

## 2. Git 状态

- 分支：`master`
- 最新提交：`1e3ca67 feat: foliate-js MOBI, startup speedups, and resizable sidebars`
- 工作区：仅未跟踪临时日志 `scripts/boot-err.txt`、`scripts/boot-out.txt`（可忽略或删除）
- 项目根：`D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll`

## 3. 项目结构

- 项目根：`D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll`
- 技术栈：Electron 31 + React 18 + TypeScript + electron-vite + Tailwind + Zustand
- 关键目录：
  - `src/main/` — 主进程（窗口、IPC、存储、封面协议 `covers.ts`）
  - `src/renderer/` — React UI / 解析器
  - `out/` — 构建产物（`Scroll.vbs` 直接跑这里）
  - `Information/` — 最新 handoff
  - `CLAUDE.md` / `HANDOFF.md` — 项目指令与旧交接（HANDOFF.md 已过时）

## 4. 运行方式

| 用途 | 命令 |
|------|------|
| 日常生产启动 | 双击 `Scroll.vbs`（跑 `out/`） |
| 开发 | `start.bat`（更慢，调试用） |
| 构建 | `rebuild.bat` 或 `npx electron-vite build` |
| 打包 exe | `make.bat` / `build.bat` |

环境：Node 20+，Windows 10/11。

用户数据（本机）：

- 书架 JSON：`%APPDATA%\Electron\data\books_books.json`
- 封面文件：`%APPDATA%\Electron\covers\{bookId}.jpg`
- 封面 URL 格式：`scroll-cover://local/{bookId}`

## 5. 已实现能力（本轮）

1. **MOBI/AZW3 → foliate-js**（`mobiParser.ts` + `foliate-js/mobi.js`）
2. **书名清洗**（`bookTitle.ts`）
3. **豆瓣评分**：仅导入时拉一次 + 书架手动刷新；启动不请求
4. **封面落盘**（`covers.ts` + `scroll-cover://` 协议）
5. **启动优化**：闪屏、`app:bootstrap`、懒加载、去 StrictMode、`Scroll.vbs` 直启
6. **左右侧栏可拖动改宽**（`LeftSidebar.tsx` / `RightSidebar.tsx`，宽度存 localStorage）
7. **侧栏折叠行为**：侧栏内「目录/书签」标签只切换内容；**仅顶栏图标**折叠/展开左侧栏（`setLeftSidebarTab` vs `toggleLeftSidebar`）

## 6. 进展与缺口

| 项 | 状态 |
|----|------|
| MOBI foliate 可读 | ✅ |
| 书名清洗 / 评分策略 / 封面落盘 | ✅ |
| 左右侧栏拖动 | ✅ |
| 侧栏不误收起 | ✅ |
| git commit | ✅ `1e3ca67` |
| 启动体感仍慢 | ⚠️ 待用户复测（区分窗晚出 vs 卡启动页） |
| 封面加载慢 | ⚠️ 待复测 |
| DJVU / CBR / 全局字号 | ❌ 低优先级 |
| 更新旧 `HANDOFF.md` | ❌ 可选 |

## 7. 重要决策与约束

1. **MOBI 用 foliate-js**，不要自研、不要捆绑 Calibre。
2. **EPUB 全量渲染**；NCX 用 DOMParser。
3. **豆瓣：导入拉一次 + 手动刷新**；禁止启动批量请求。
4. **封面不进 JSON**；只存 `scroll-cover://` 引用。
5. 日常 **`Scroll.vbs` + `rebuild.bat`**；改代码后需重建 `out/`。
6. PowerShell 用 `;` 不用 `&&`。
7. 测试书目录（只读）：`D:\10_Books\05_人文艺术与生活类`

## 8. 已知坑

1. `setup_calibre.bat` / Calibre 方案已废弃。
2. 旧 HANDOFF.md 仍写半移植 MOBI —— 以本文件为准。
3. 封面迁移需接受 `data:application/octet-stream;base64,` MIME。
4. 启动慢可能是 Defender 扫 `node_modules\electron`，勿误用 `start.bat` 当日常启动。
5. 侧栏宽度 key：`scroll-left-sidebar-width` / `scroll-right-sidebar-width`（localStorage）。

## 9. 建议下一步

1. 用户复测启动与封面加载，反馈「窗晚出」还是「卡启动页」。
2. 若启动仍慢：Defender 排除项或 portable `Scroll.exe` 打包优化。
3. 低优先级：DJVU、CBR、全局字体缩放；对齐旧 `HANDOFF.md`。

## 11. 2026-07-13 下午增量

| 项 | 状态 | 说明 |
|----|------|------|
| 启动优化（preload bootstrap / 拆包 / lazy 封面） | ✅ 已做 | 用户反馈「好一些了」 |
| 书架卡片缩小 30% | ✅ | `auto-fill minmax(8.5rem)` + 卡片内文字缩小 |
| 豆瓣评分排查 | ✅ 已定位 | 公司网络 `ECONNRESET`，book/frodo/api 全失败；UI 现显示「无法连接豆瓣/被网络拦截」 |
| 阅读主题覆盖整窗 | ✅ | `reader-chrome` CSS 变量：顶栏/侧栏/工具栏/正文统一色系，分隔线 `--reader-border` 加深 |

**豆瓣结论：** 非代码解析问题，是公司防火墙阻断 `*.douban.com`。换网络/VPN 或手动输入评分（未做）才可解决。

**待办 backlog：** DJVU / CBR / 全局字号 / 同步旧 HANDOFF.md


```text
请接手本项目上下文，不要从零开始。

目标项目：
D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll

请先阅读以下文件（按顺序）：
1. Information/Handoff_foliate启动优化_2026-07-13.md
2. CLAUDE.md
3. HANDOFF.md（旧交接，作补充；以 Information 下最新 handoff 为准）

项目概况：
- 技术栈：Electron 31 + React 18 + TypeScript + electron-vite + Tailwind + Zustand
- 日常启动：双击 Scroll.vbs（跑 out/）
- 构建：rebuild.bat 或 npx electron-vite build
- 开发：start.bat（较慢，非日常）

最新提交：
1e3ca67 feat: foliate-js MOBI, startup speedups, and resizable sidebars

当前分支：master

重要决策与约束：
- MOBI/AZW3 用 foliate-js，不要自研解析，不要再捆绑 Calibre
- EPUB 全量渲染；NCX 用 DOMParser
- 豆瓣评分：仅导入时拉一次 + 书架手动刷新；禁止启动批量请求
- 封面存 userData/covers，JSON 只留 scroll-cover:// 引用
- 左右侧栏可拖动；侧栏内点目录/书签不收起，仅顶栏图标折叠
- PowerShell 用 ; 不用 &&

开始前请运行验证：
cd D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll; git status --short; npx electron-vite build

当前进度：
- 已完成：foliate-js MOBI、启动优化、封面落盘、侧栏拖动、侧栏折叠修复、已 commit 1e3ca67
- 待完成：用户复测启动/封面；低优先级 DJVU/CBR/全局字号

不要急着写代码，先通读上述文件确认当前实现状态和剩余缺口，再给出下一阶段计划。
```
