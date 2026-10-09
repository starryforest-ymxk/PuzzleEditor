# 快速入门

[返回使用指南](cli-guide.md) · [文件命令](commands-files.md) · [完整教程](workflows.md)

## 准备工具

Windows x64 独立包自带 Node，无需全局 Node/npm。完整解压后，可以直接调用包根的 puzzle.cmd，也可以安装为全局命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-cli.ps1 --install-root 'D:\Tools\PuzzleEditorCLI' --dry-run
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-cli.ps1 --install-root 'D:\Tools\PuzzleEditorCLI'
```

安装位置可自行指定；此处是示例。重新打开终端后执行以下命令，旧终端也可直接使用安装根下 bin/puzzle.cmd 的绝对路径。

```powershell
puzzle version --json
puzzle doctor --offline --json
puzzle skills install --agent codex --scope user --dry-run
puzzle skills install --agent codex --scope user
```

安装 Skill 不授予工程高权限。基础离线操作无需配置文件、网络账户或运行桌面程序。

## 完整操作示例

本例的名称规格明确为工程 Demo、根资产 DemoRoot。脚本只创建新目录和文件，依次执行 version、describe、create、inspect、preview、apply、validate、export。编辑计划使用刚读取的根 ID 和源 hash。

先在 PowerShell 中进入本页所在的 references 目录，然后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\quick-start.ps1 -Puzzle 'D:\Tools\PuzzleEditorCLI\bin\puzzle.cmd'
```

也可以给 -WorkDirectory 指定一个尚不存在的绝对目录。全部计划构造和 UTF-8 写入都已包含在[完整脚本](examples/quick-start.ps1)及[共用调用函数](examples/common.ps1)中；不需要自行准备 edit-plan.json。可先阅读脚本再运行。

输出对象的 source 指向原工程，output 指向修改后工程，export 指向运行时文件，validated 应为 true。新根 Stage 的 description 应为 `Edited through the CLI`，原工程保持不变。脚本会在退出码或 ok 异常时立即停止。

## 迁移到实际工程

1. 运行 inspect 获取实际 source.sha256、目标 ID 和 owner。
2. 根据需要查阅相应领域参考；只声明任务需要的 scope。
3. 将完整 plan 保存为 UTF-8，再 preview 并检查 changes、impacts、requiredCapabilities、remainingErrors。
4. 使用同一回执 apply 到明确的新路径，validate 后按需求 export。

请勿把示例资产名、固定 ID 或教程中的 project=true 直接套用到未知工程。assetName 必须来自用户或其提供的规格；缺失时询问。覆盖、直接 JSON 编辑和永久删除受保护资源遵循[独立授权要求](permissions-errors.md)。
