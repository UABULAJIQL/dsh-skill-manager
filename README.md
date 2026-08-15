# @sqnb/dsh-skill-manager

中文 | [English](README.en.md)

DSH 的 Skill 管理插件，可配置本地 skill 扫描路径，保留 DSH 官方默认路径，并按名称启用或禁用已发现的 skill。

## 安装

从 GitHub 安装到 `web` profile：

```powershell
dsh plugin --profile web add https://codeload.github.com/UABULAJIQL/dsh-skill-manager/tar.gz/refs/heads/main
```

安装后完整停止并重新启动 `dsh web`。浏览器刷新不会加载新的 profile bundle。

从本地 checkout 安装时使用 `file:` 协议：

```powershell
dsh plugin --profile web add file:C:/path/to/dsh_plugin/dsh-skill-manager
```

不要直接传入本地目录路径。pnpm 会将其解析为 `link:`，只链接源码而不安装插件运行时依赖，可能导致 `dsh web` 无法启动。

## 使用

1. 安装并重启后，在会话的 preset 选择器中选择 **Code (Skill Manager)**。该操作只切换当前会话；原有会话保持自己的 preset。
2. 打开 **设置 > Skills**。
3. 保持 **使用 DSH 官方默认路径** 启用，以包含项目级、用户级、内置路径和 `~/.agents/skills`。
4. 在 **扫描路径** 中添加包含 `SKILL.md` 或 skill 子目录的绝对路径。
5. 在 **已发现的 Skills** 中切换启用状态。长描述默认显示两行，点击 **展开** 查看完整内容。

## 配置

配置文件位于 DSH home 的 `skill-manager.json`：

```json
{
  "includeDefaultRoots": true,
  "paths": [],
  "disabled": []
}
```

`paths` 保存自定义扫描路径；`disabled` 保存已禁用的 skill 名称。同名 skill 使用同一个启用状态。

## 行为

- 安装时通过官方 `agentPresets.copy()` 创建用户 preset `skill-manager-code`，并在该 preset 内替换 `skill-filesystem` 为 manager provider。不会修改官方 `code` preset，也不会在 `agent/created` 生命周期中注册 provider。
- 复用 DSH 官方 `FileSystemSkillProvider` 的 `SKILL.md` 解析、资源目录和文件 watcher。
- 路径或默认根目录变化后会重新扫描使用 **Code (Skill Manager)** 的会话 catalog。
- 启用或禁用单个 skill 只更新当前行和 provider 状态，不会清空或重绘整个列表。

## 卸载

```powershell
dsh plugin --profile web remove @sqnb/dsh-skill-manager
```

完成后重新启动 `dsh web`。`skill-manager-code` 是用户 preset；在卸载前请将使用它的会话切换回其他 preset，并在 preset 设置中删除 **Code (Skill Manager)**，避免旧会话在缺少插件 entrypoint 时无法重新打开。

## 许可证

MIT

Copyright (c) 2026 sqnb
