# 卷轴 Scroll — 打包与分发

> 更新：2026-07-14

## 给谁用

| 角色 | 需要什么 | 做什么 |
|------|----------|--------|
| **开发者（你）** | Node.js 20+ | 双击 `pack.bat` 生成 zip |
| **收包人** | 无 | 解压 zip，双击 `Scroll.exe` |

## 一键打包

```text
双击 pack.bat
（或 build.bat — 同 pack.bat）
```

流程（`scripts/pack.ps1`）：

1. 检查 / 安装 `node_modules`（仅首次）
2. `electron-vite build` → `out/`
3. `electron-builder --win dir` → `release/win-unpacked/`（完整便携文件夹）
4. 复制整个文件夹 + 生成 `README.txt` → `dist/Scroll-{version}-win-x64/`
5. 打 zip → `dist/Scroll-{version}-win-x64.zip`
6. 自动打开 `dist` 文件夹

### 输出物

```text
dist/
  Scroll-0.1.0-win-x64/
    Scroll.exe          # 主程序
    resources/          # 应用资源
    locales/            # 语言包
    *.dll               # 运行时依赖
    README.txt          # 中英文使用说明（UTF-8 BOM）
    UserData/           # 首次运行后生成：书架/设置/标注/封面
  Scroll-0.1.0-win-x64.zip   # 发给他人
```

**整夹复制即可运行**；若需带走数据，一并复制 `UserData/`。

`release/`、`out/`、`dist/` 均在 `.gitignore` 中，**不提交 Git**。

## 配置要点

| 文件 | 作用 |
|------|------|
| `electron-builder.yml` | 便携文件夹（dir）、禁用代码签名（免 winCodeSign） |
| `.npmrc` | electron / builder 国内镜像 |
| `scripts/README.dist.txt` | 发布包说明模板 |
| `tools/offline/` | 可选：预置 builder 离线 `.7z`（见该目录 README） |

打包环境变量（`pack.ps1` 自动设置）：

- `ELECTRON_MIRROR`、`ELECTRON_BUILDER_BINARIES_MIRROR` → npmmirror
- `CSC_IDENTITY_AUTO_DISCOVERY=false` → 不下载 winCodeSign

## 开发 vs 发布启动

| 场景 | 启动 |
|------|------|
| 改代码后自测 | `rebuild.bat` + `Scroll.vbs`（跑 `out/`） |
| 测便携包 | 运行 `release/win-unpacked/Scroll.exe` 或 zip 解压后的文件夹 |
| 热重载开发 | `start.bat` |

`Scroll.vbs` 逻辑：若 `release/win-unpacked/Scroll.exe` 新于 `out/` 则优先用它，否则用 `node_modules/electron` + `out/main/index.js`。

## 常见问题

**pack 卡在下载 / 很慢**  
首次需拉 NSIS 等 builder 工具；已配国内镜像。可将 `nsis-*.7z` 放入 `tools/offline/` 后重试。

**README 乱码**  
发布包内应为 `README.txt`（UTF-8 BOM）。勿用旧版 `使用说明.txt`。

**杀软误报**  
未签名便携 exe 可能被 Defender 拦截；收包人需加信任。完整步骤见 **[docs/06-troubleshooting.md](./06-troubleshooting.md)**（排除项、解除锁定、收包说明）。

**发布前冒烟**  
双击 **`smoke-check.bat`**（typecheck + build + 产物校验），再按 06 文档 §3.2 做 3 分钟人工清单。

**main/preload 改代码后**  
便携包需重新 `pack.bat`；开发时改 main/preload 须完全退出再启 `Scroll.vbs`。

## npm 脚本（可选）

```powershell
npm run build          # 仅编译 out/
npm run pack           # build + electron-builder dir（不含 dist zip）
```

完整 zip 仍推荐 **`pack.bat`**（含第 4 步 dist 整理）。
