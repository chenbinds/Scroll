# CLAUDE.md — 卷轴 Scroll

> 项目级指令，与 `D:\00_AIT_Work\CLAUDE.md` 的黄金准则合并生效。

## 技术栈

- Electron 31 + React 18 + TypeScript
- electron-vite 构建，Tailwind CSS 样式
- Zustand 状态管理，JSON 文件存储

## 启动方式

双击根目录的 `start.bat`（开发模式）

## 目录结构

```
scroll-ebook-reader/
├── src/main/         # Electron 主进程（窗口、IPC、存储）
├── src/preload/      # contextBridge 安全桥接
├── src/renderer/     # React 渲染进程
│   └── src/
│       ├── components/layout/   # 布局
│       ├── components/library/  # 书架
│       ├── components/reader/   # 阅读器
│       ├── components/ai/       # AI 面板
│       ├── components/music/    # 音乐播放器
│       ├── stores/              # Zustand 状态
│       └── lib/                 # 工具库
├── docs/             # 项目文档（设计、ADR、规格、日志）
├── install.bat       # 一键安装依赖
├── start.bat         # 一键启动开发
└── build.bat         # 一键构建打包
```
