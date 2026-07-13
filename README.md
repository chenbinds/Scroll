# 卷轴 Scroll

> AI 增强的本地电子书阅读器 · Electron 桌面应用

**卷轴 Scroll** 是一款多格式本地电子书阅读器，支持 EPUB、MOBI/AZW3、PDF、TXT、CBZ/CBR 等格式，内置阅读标注、AI 助手与氛围音乐。

## 核心特性

- **多格式阅读** — EPUB、MOBI/AZW/AZW3、PDF、TXT/MD、CBZ/CBR
- **阅读标注** — 画笔（8 图形）/ 橡皮 / 文字标记+笔记；EPUB/MOBI/TXT 全套；PDF/CBZ 画笔；按书独立存储
- **AI 阅读助手** — OpenAI 兼容 API；流式输出；按书会话持久化；选区/标注笔记一键提问
- **书架管理** — 导入、进度、封面落盘、豆瓣评分（自动 + 手动）
- **书签 & 标注侧栏** — 位置书签按书隔离；列出高亮/笔画并跳转
- **阅读主题** — 5 套主题 + 3 字体 + 全局字号（60–200%）
- **音乐播放器** — Web Audio 内置氛围音 + URL/本地曲目
- **中英双语** — 界面语言切换
- **本地优先** — 数据存于本机 `userData`

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 31 |
| 前端 | React 18 + TypeScript |
| 构建 | electron-vite + Vite |
| 样式 | Tailwind CSS |
| 状态 | Zustand + JSON 文件存储 |
| EPUB | JSZip 自研解析（DOMParser NCX） |
| MOBI/AZW3 | **foliate-js** 全量渲染 |
| PDF | pdf.js |
| AI | OpenAI 兼容 API（主进程代理，支持 SSE 流式） |

> **禁止**捆绑 Calibre 或自研 MOBI 二进制解析。旧 Calibre 脚本已删除。

## 快速开始

### 环境要求

- Node.js 20+
- Windows 10/11

### 安装与运行

| 用途 | 命令/文件 |
|------|-----------|
| 首次安装 | `install.bat` |
| 日常启动 | `Scroll.vbs`（优先 `release/Scroll.exe`） |
| 构建 | `rebuild.bat` 或 `npx electron-vite build` |
| 打包 | `build.bat` → `release/Scroll.exe` |
| 开发调试 | `start.bat` |

PowerShell 示例：

```powershell
cd D:\path\to\Scroll; npx electron-vite build
```

### 配置 AI

1. 右上角 **设置**（或 `Ctrl+Shift+S`）
2. 选择预设或填写 API 地址、Key、模型
3. 点击 **测试连通性** 验证（公司网/代理环境下尤其有用）
4. 支持 DeepSeek / OpenAI / 通义千问 / Moonshot / GLM / SiliconFlow 等

## 各格式状态

| 格式 | 阅读 | 标注 | 备注 |
|------|------|------|------|
| EPUB | ✅ | ✅ 全套 | 全量 HTML 渲染 |
| MOBI/AZW/AZW3 | ✅ | ✅ 全套 | foliate-js |
| TXT/MD | ✅ | ✅ 全套 | 正则分章 |
| PDF | ✅ | ✅ 画笔/橡皮 | 标记禁用（无文字选区） |
| CBZ/CBR | ✅ | ✅ 画笔/橡皮 | 按页坐标，缩放友好 |
| DJVU | ❌ | — | 占位 |

## 标注架构（红线）

1. **不改正文 DOM** — Overlay 与 `reader-scroll` 为兄弟层
2. Canvas 仅视口大小；文档坐标 0~1；漫画/PDF 按页归一化
3. 存储：`annotations_{bookId}.json`
4. 离开：唯一通道 `requestLeave` → React 弹窗

## 项目结构

```
Scroll/
├── src/main/           # 主进程：IPC、存储、豆瓣、封面
├── src/preload/        # contextBridge；启动 bootstrap
├── src/renderer/       # React UI
│   └── src/
│       ├── components/
│       │   ├── reader/annotation/  # 标注全套
│       │   ├── library/            # 书架
│       │   ├── ai/                 # AI 面板
│       │   └── music/              # 音乐
│       ├── stores/                 # appStore, annotationStore
│       └── lib/                    # 解析器、标注、AI
├── Information/        # Handoff 文档
├── TODO.md             # 待办清单
├── CLAUDE.md           # Agent 指令
├── Scroll.vbs          # 日常启动
├── rebuild.bat         # 构建到 out/
└── build.bat           # 便携包 release/Scroll.exe
```

## 文档

| 文件 | 说明 |
|------|------|
| [TODO.md](./TODO.md) | 待验收 / backlog |
| [CLAUDE.md](./CLAUDE.md) | 项目级开发约束 |
| [HANDOFF.md](./HANDOFF.md) | 交接摘要 |
| `Information/` | 详细 handoff（含标注规格） |

## License

MIT © Brandon Chen  
MOBI 渲染基于 foliate-js；请勿重新引入 Calibre 依赖。
