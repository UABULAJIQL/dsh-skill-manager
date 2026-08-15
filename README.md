# @sqnb/dsh-skill-manager

DSH 的 Skill 管理插件，可配置本地 skill 扫描路径，保留 DSH 官方默认路径，并按名称启用或禁用已发现的 skill。

## 安装

从本地 checkout 安装时使用 `file:` 协议：

```powershell
dsh plugin --profile web add file:C:/path/to/dsh_plugin/dsh-skill-manager
```

安装后完整停止并重新启动 `dsh web`。浏览器刷新不会加载新的 profile bundle。

不要直接传入本地目录路径。pnpm 会将其解析为 `link:`，只链接源码而不安装插件运行时依赖，可能导致 `dsh web` 无法启动。

## 使用

1. 打开 **设置 > Skills**。
2. 保持 **使用 DSH 官方默认路径** 启用，以包含项目级、用户级、内置路径和 `~/.agents/skills`。
3. 在 **扫描路径** 中添加包含 `SKILL.md` 或 skill 子目录的绝对路径。
4. 在 **已发现的 Skills** 中切换启用状态。长描述默认显示两行，点击 **展开** 查看完整内容。

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

- 复用 DSH 官方 `FileSystemSkillProvider` 的 `SKILL.md` 解析、资源目录和文件 watcher。
- 路径或默认根目录变化后会重新扫描当前会话的 skill catalog。
- 启用或禁用单个 skill 只更新当前行和 provider 状态，不会清空或重绘整个列表。

## 卸载

```powershell
dsh plugin --profile web remove @sqnb/dsh-skill-manager
```

完成后重新启动 `dsh web`，内置 filesystem provider 会恢复。

## 许可证

MIT

Copyright (c) 2026 sqnb
