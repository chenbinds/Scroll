# Handoff：foliate-js 与启动优化

## 1. 当前状态

卷轴 Scroll 本轮已把 MOBI/AZW3 从「半移植解析器 / Calibre」切到 **foliate-js**（与 Koodo 同源），并做了书名清洗、豆瓣评分策略调整、封面落盘与启动优化。**代码已构建进 `out/`，但尚未 git commit。** 用户侧仍反馈启动偶发慢（实测应用侧约 0.4s 就绪，怀疑 Windows 杀软扫描 electron.exe）。

## 2. Git 状态

- 分支：`master`
- 最新提交：`af5fcd7 docs: final update for handoff - CLAUDE.md + memory files`
- 工作区：大量未提交修改（见下）+ 未跟踪新文件
- 项目根：`D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll`

### 主要变更文件

- 修改：`src/main/index.ts`、`storage.ts`、`preload`、`App.tsx`、`AppShell`、`LibraryView`、`BookCard`、`MobiReader`、`EpubReader`、`mobiParser.ts`、`epubParser.ts`、`Scroll.vbs`、`electron-builder.yml`、`package.json`、`CLAUDE.md`、locales 等
- 新增：`src/main/covers.ts`、`src/renderer/src/lib/bookTitle.ts`、`coverImage.ts`、`src/renderer/src/types/foliate-js.d.ts`、`scripts/migrate-covers.js` 等

## 3. 项目结构

- 项目根：`D:\00_AIT_Work_Cursor\Projects\03_Scroll\Scroll`
- 技术栈：Electron 31 + React 18 + TypeScript + electron-vite + Tailwind + Zustand
- 关键目录：
  - `src/main/` — 主进程（窗口、IPC、存储、封面协议）
  - `src/renderer/` — React UI / 解析器
  - `out/` — 构建产物（`Scroll.vbs` 直接跑这里）
  - `docs/` — 产品/架构文档
  - `CLAUDE.md` / `HANDOFF.md` — 项目指令与旧交接

## 4. 运行方式

| 用途 | 命令 |
|------|------|
| 日常生产启动 | 双击 `Scroll.vbs`（跑 `out/`） |
| 开发 | `start.bat`（更慢，调试用） |
| 构建 | `rebuild.bat` 或 `npx electron-vite build` |
| 打包 exe | `make.bat` / `build.bat` |

环境：Node 20+，Windows 10/11。

用户数据（本机）：

- 书架 JSON：`%APPDATA%\Electron\data\books_books.json`（已瘦到约 3.6KB）
- 封面文件：`%APPDATA%\Electron\covers\{bookId}.jpg`
- 封面 URL 格式：`scroll-cover://local/{bookId}`

## 5. 已实现能力（本轮）

1. **MOBI/AZW3 → foliate-js**  
   - `mobiParser.ts` 用 `foliate-js/mobi.js` + `fflate`  
   - 去掉 Calibre 主路径与 `mobi:convert` IPC  
   - `electron-builder.yml` 不再打包 `tools/`

2. **书名清洗**（`bookTitle.ts`）  
   - 去掉 z-library 后缀、长宣传语括号  
   - 导入 + 打开书时同步到顶栏/目录/书架

3. **豆瓣评分策略**  
   - **仅导入时**自动拉一次  
   - **启动不再请求**  
   - 书架封面悬停可手动点星标刷新

4. **封面落盘**（`src/main/covers.ts`）  
   - 缩略图 JPEG 存 `userData/covers/`  
   - 自定义协议 `scroll-cover://`  
   - 启动时迁移残留 `data:` 封面（含错误 MIME `application/octet-stream`）

5. **启动优化**  
   - 窗口立即显示启动闪屏「正在启动…」  
   - `app:bootstrap` 一次 IPC 拉齐 books/settings  
   - 阅读器 / 设置 / 侧栏 / 音乐懒加载  
   - 去掉 React StrictMode  
   - `Scroll.vbs` 直接启动 electron，不套 cmd  
   - 本机实测：`did-finish-load ~372ms`，`bootstrap ~390ms`

## 6. 进展与缺口

| 项 | 状态 |
|----|------|
| MOBI 用 foliate 可读 | ✅ 用户已确认「可以了」 |
| 书名不显示文件名脏串 | ✅ |
| 评分不在启动刷 | ✅ |
| 启动体感仍慢（用户报白屏~8s） | ⚠️ 应用侧已快；疑杀软/冷启动，待用户反馈最新构建 |
| 封面加载~3s | ⚠️ 封面已落盘且很小；待复测 |
| DJVU / CBR / 全局字号 | ❌ 未做 |
| git commit | ❌ 用户未要求提交 |

## 7. 重要决策与约束

1. **不要自研 MOBI 二进制解析**；用 foliate-js，不要再捆绑 Calibre（~200MB）进安装包。
2. **EPUB 全量渲染**，不做虚拟章节；NCX 用 DOMParser。
3. **豆瓣：导入拉一次 + 手动刷新**；禁止启动批量请求。
4. **封面不进 JSON**；只存 `scroll-cover://` 引用。
5. 日常用 **`Scroll.vbs` + `rebuild.bat`**；改代码后需重建 `out/`。
6. 测试书目录（只读）：`D:\10_Books\05_人文艺术与生活类`（若本机有）。

## 8. 已知坑

1. `setup_calibre.bat` 把 Portable **installer.exe** 当 zip 解压 —— 方案已废弃，勿再依赖。
2. 旧「Koodo 移植」解析器 HUFF/CDIC 乱码；根因是半移植，不是格式无解。
3. 部分封面曾是 `data:application/octet-stream;base64,`（实为 JPEG），迁移正则必须接受非 `image/*` MIME。
4. 用户感知「白屏 8 秒」与应用内 bootstrap 时间不符；优先查 Defender 扫描 `node_modules\electron`、是否误用 `start.bat`。
5. PowerShell 不支持 `&&`，用 `;`。

## 9. 建议下一步

1. 请用户用最新 `Scroll.vbs` 复测启动：区分「很久才弹出窗口」vs「立刻弹出但卡在启动页」。
2. 若仍是前者：加 Windows 安全中心排除项，或做真正的 portable `Scroll.exe` 打包路径优化。
3. 用户确认启动可接受后：**按用户要求再 git commit**（当前未提交）。
4. 可选：更新 `HANDOFF.md` / `CLAUDE.md` 与本文件对齐（封面协议、bootstrap）。
5. 低优先级：DJVU、CBR、全局字体缩放。

## 10. 下个窗口启动提示词

见下方「可复制提示词」；也可直接复制本文件第 10 节意涵给新会话。
