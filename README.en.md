# @sqnb/dsh-skill-manager

[中文](README.md) | English

A DSH Skill Manager plugin for configuring local skill scan paths, preserving DSH's official roots, and enabling or disabling discovered skills by name.

## Installation

Install the published GitHub package into the `web` profile:

```powershell
dsh plugin --profile web add https://codeload.github.com/UABULAJIQL/dsh-skill-manager/tar.gz/refs/heads/main
```

Fully stop and restart `dsh web` after installation. A browser refresh does not load a new profile bundle.

When installing from a local checkout, use the `file:` protocol:

```powershell
dsh plugin --profile web add file:C:/path/to/dsh_plugin/dsh-skill-manager
```

Do not pass a local directory path bare. pnpm treats it as `link:`, which links the source without installing the plugin runtime dependencies and can prevent `dsh web` from starting.

## Usage

1. After installation and restart, choose **Code (Skill Manager)** from the session preset selector. This switches only the current session; existing sessions keep their own preset.
2. Open **Settings > Skills**.
3. Keep **Use DSH official default roots** enabled to include project, user, bundled, and `~/.agents/skills` roots.
4. Add absolute paths containing `SKILL.md` files or skill directories under **Scan paths**.
5. Toggle skills under **Discovered skills**. Long descriptions are limited to two lines by default; click **Expand** to view the full text.

## Configuration

The configuration file is `skill-manager.json` in the DSH home directory:

```json
{
  "includeDefaultRoots": true,
  "paths": [],
  "disabled": []
}
```

`paths` contains custom scan paths. `disabled` contains disabled skill names. Skills with the same name share one enabled state.

## Behavior

- Installation uses the official `agentPresets.copy()` API to create the user-owned `skill-manager-code` preset, then replaces its `skill-filesystem` row with the manager provider. It does not modify the official `code` preset or register a provider during `agent/created`.
- Reuses DSH's official `FileSystemSkillProvider` for `SKILL.md` parsing, resource roots, and file watching.
- Path or default-root changes rescan the catalog of sessions using **Code (Skill Manager)**.
- Enabling or disabling one skill updates its row and provider state without clearing or redrawing the full list.

## Uninstalling

```powershell
dsh plugin --profile web remove @sqnb/dsh-skill-manager
```

Restart `dsh web` after removal. `skill-manager-code` is a user preset: before uninstalling, switch any sessions that use it to another preset and remove **Code (Skill Manager)** from preset settings, so an old session cannot try to resolve a removed plugin entrypoint.

## License

MIT

Copyright (c) 2026 sqnb
