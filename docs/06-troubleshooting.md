# 卷轴 Scroll — 故障排除与验收

> 更新：2026-07-14  
> 对应 TODO **P6**：杀软误报说明 + 发布前冒烟

---

## 1. Windows Defender / 杀软误报

Scroll 是**未代码签名**的 Electron 便携 exe。首次运行或更新后，Windows Defender、360、火绒等可能：

- 拦截下载 / 解压
- 弹出「已阻止此应用」或 SmartScreen 警告
- 导致启动极慢（实时扫描每个 DLL）

这**不等于**程序有毒；本地开发构建普遍会遇到。长期方案是购买代码签名证书；当前靠「加排除 + 解除锁定」即可日常使用。

### 1.1 解除文件锁定（SmartScreen / 下载拦截）

1. 右键 `Scroll.exe` → **属性**
2. 若底部有 **「解除锁定」** 或 **Unblock**，勾选 → 确定
3. 再次双击运行

### 1.2 Windows 安全中心 — 添加排除项（推荐）

**按文件夹排除（开发/自测）：**

1. **设置** → **隐私和安全性** → **Windows 安全中心** → **病毒和威胁防护**
2. **管理设置**（病毒和威胁防护设置）
3. 滚动到 **排除项** → **添加或删除排除项**
4. **添加排除项** → **文件夹**，任选其一：
   - 项目目录：`...\Scroll\`（含 `out/`、`release/`、`node_modules/`）
   - 仅便携包：`...\Scroll\release\` 或解压后的 `Scroll-*-win-x64\`

**按进程排除（仅便携 exe）：**

同上路径 → **添加排除项** → **进程** → 输入 `Scroll.exe`

### 1.3 360 / 火绒 / 企业 EDR

| 产品 | 常见操作 |
|------|----------|
| **360** | 弹窗选「信任此程序」；或 设置 → 信任区 → 添加文件/文件夹 |
| **火绒** | 安全设置 → 信任区 → 添加 `Scroll.exe` 或整个解压目录 |
| **企业 EDR** | 联系 IT 将 `Scroll.exe` 或 SHA256 加入白名单 |

### 1.4 如何判断是杀软拖慢启动

- 任务管理器里 **Windows Defender Antimalware Service** CPU 偏高，且 Scroll 窗口迟迟不出现
- 排除项目目录后，**冷启动**（完全退出再开）明显变快 → 多半是扫描导致
- 应用内 bootstrap 通常 < 1s；若窗体 10s+ 才出，优先查杀软

### 1.5 收包人说明（可转发）

发布 zip 内 `README.txt` 已有一句「杀毒软件误报」。完整步骤可把本文 **§1.1–1.2** 或链接发给对方。

---

## 2. 其它常见问题

| 现象 | 处理 |
|------|------|
| 双击无反应 | 确认 64 位 Windows；属性里解除锁定；查杀软隔离区 |
| 改 main/preload 后行为旧 | 完全退出 Scroll（托盘也关），再 `rebuild.bat` 或 `pack.bat` |
| 便携包与开发不同步 | 改代码后需重新 `pack.bat`；日常自测用 `Scroll.vbs` + `out/` |
| 目录白屏 | 已知修复（2026-07-14）；若复现请带版本与复现步骤反馈 |
| AI 查义不出现 | 选区 ≤ 80 字；且未开启标记/画笔工具 |

---

## 3. 发布前冒烟

### 3.1 自动检查（构建 + 产物）

```text
双击 smoke-check.bat
```

或：

```powershell
cd D:\path\to\Scroll
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-check.ps1
```

可选参数：

| 参数 | 说明 |
|------|------|
| `-SkipBuild` | 跳过 build，只检查 `out/` 是否齐全 |
| `-CheckPortable` | 额外检查 `release/Scroll.exe` 是否存在 |

脚本会执行：`npm run typecheck` → `npm run build` → 校验 `out/main`、`out/preload`、`out/renderer` 关键文件。

### 3.2 人工检查清单（约 3 分钟）

发版或较大改动后建议走一遍：

- [ ] **冷启动**：`rebuild.bat` 后 `Scroll.vbs`，或 `pack.bat` 产出之 `Scroll.exe`
- [ ] **打开 EPUB**：滚动一段，加书签或标记+笔记，**保存**
- [ ] **回书架**：若有未保存标注，离开弹窗正常；确认后回到书架
- [ ] **再进同一本书**：进度大致对齐；目录可开、不白屏
- [ ] **主题 / 字号**：阅读主题下拉与暗色一致；回书架再进字号仍保留
- [ ] **PDF（可选）**：画笔/橡皮；缩放后标注不错位；「标记」禁用+提示
- [ ] **MOBI（可选）**：画笔+标记+保存

全部通过即可认为 P6 冒烟 OK；有问题记入 issue 或 `TODO.md` P0。

---

## 4. 相关文档

- [05-packaging.md](./05-packaging.md) — 打包与分发
- [TODO.md](../TODO.md) — P0 验收 / P6 工程项
