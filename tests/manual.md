# 手动冒烟清单

> 自动化验证先跑 `npm run verify`。下面这些项需要真实终端与真实 pi。
>
> 权限审批由专门的包负责；pi-ds-tui 不实现审批对话框，也不拦截工具调用。

## 准备

- [ ] 配置已就位：`~/.pi/agent/pi-ds-tui.json`（Windows：`C:/Users/<user>/.pi/agent/pi-ds-tui.json`）。
- [ ] 未安装时用 `pi -e .` 启动；已安装时直接 `pi`。
- [ ] `/settings` → Theme 选择 `dsh-dark` 或 `dsh-light`。
- [ ] 离线预览 Markdown 转换：`npm run preview:markdown`（默认 40/60/80/120 列）。

## 启动

- [ ] `pi -e .`（默认 fullscreen）能启动，无启动报错。
- [ ] `pi -e . --tui-mode regular` 能启动。
- [ ] 输入 `/ds-ui`，能看到 config 路径、footer/header/editor/working/markdown/toolCards 开关与 warnings。

## Footer

- [ ] 底部出现三行：cwd；context/tokens/cache/cost/git/effort + model；扩展状态。
- [ ] 宽度 120 时所有芯片可见。
- [ ] 宽度 40 时只保留 context 与 model，且不换行、不溢出。
- [ ] 中文/emoji cwd 不破坏对齐。
- [ ] 切换 dsh-dark / dsh-light，颜色正确，无旧颜色残留。
- [ ] `footer.enabled: false` 后恢复 pi 内置 footer。

## M5 工具卡

### 外壳

- [ ] `read`、`write`、`edit`、`bash`、`grep`、`find`、`ls` 都显示状态点 + 工具名 + 参数 + 耗时。
- [ ] 运行中为 `●`，成功为 `✓`，失败为 `✗`。
- [ ] 背景跟随 `toolPendingBg` / `toolSuccessBg` / `toolErrorBg`。
- [ ] 窄终端（40 列）下路径中段截断、命令保留尾部，不溢出。
- [ ] `toolCards.enabled: false` 后全部恢复 pi 默认渲染。
- [ ] MCP / subagent / todo 等第三方工具仍显示它们自己的卡片。

### Call

- [ ] `read` 显示 `路径:offset+limit`。
- [ ] `write` 显示 `+N lines`；折叠时预览前 10 行，展开后显示全部。
- [ ] `edit` 显示 `N edits`。
- [ ] `bash` / `powershell` 超长命令保留尾部。
- [ ] `grep` / `find` 显示 pattern 与 `in path`；`ls` 显示目录。

### Result

- [ ] `read` 折叠时只留标题行，不刷屏（与 pi 一致）。
- [ ] `bash` 折叠时保留最后 5 行，提示显示 `… N earlier lines`。
- [ ] 其他工具折叠时为 `toolCards.collapsedLines`（默认 8）行，并显示 `… +N lines (ctrl+o to expand)`。
- [ ] `ctrl+o` 一次性展开/收起（由 pi 处理）。
- [ ] 空的流式结果显示 `running…`；有内容后不闪。
- [ ] 错误结果正文用 error 颜色；`✗` 在标题行。
- [ ] 图片结果在不开内联图片时显示 `[image …]`。

### Diff

- [ ] `edit` 的 diff 在 80 列下为单栏：`+`/`-` 行分别用 `toolDiffAdded` / `toolDiffRemoved`。
- [ ] 120 列以上为双栏，中间有 `│`，两侧都不过宽。
- [ ] `toolCards.diffMode: "unified"` 时即使宽屏也单栏；`"split"` 时强制双栏。
- [ ] 超过折叠行数时末尾显示 `… +N lines`。
- [ ] 中文/emoji 行不破坏对齐。
- [ ] `ctrl+o` 作用在所有卡片上，行为与 pi 自带的一致。

## M6 设置面板（`/ds-config`）

- [ ] `/ds-config` 在 editor 区域直接展开（与 `/settings`、`/model` 一致），不是浮层。
- [ ] 上下各有一条全宽 `─` 分隔线，宽度随终端变化。
- [ ] 列表显示 16 项，当前值与文件一致；文件不存在时显示默认值。
- [ ] 输入字母可过滤；过滤后 Esc 仍能关闭面板。
- [ ] Enter/Space 循环切换当前项，例如 `on` ↔ `off`。
- [ ] 切换后立即写入 `~/.pi/agent/pi-ds-tui.json`，无需额外确认。
- [ ] 文件中未知的 key 与无关字段不被删除。
- [ ] `diffMode` 在三态间循环；`collapsedLines` 在 8/12/16/24/32/48 间循环。
- [ ] 关闭面板后自动 reload，新配置生效，editor 恢复。
- [ ] `enabled` 关掉后 reload，只剩 `/ds-ui` 与 `/ds-config`，再用面板改回来可恢复。
- [ ] 40 列宽度下不溢出；描述行自动换行。
- [ ] 写入失败（只读目录）时列表下方显示 `save failed: …`，面板不关、不崩。
- [ ] Esc 关闭后焦点回到 editor，可直接继续输入。
- [ ] 与已有 `/model`、`/settings` 面板交替打开时互不残留。

## 组合开关

- [ ] 只关 footer：工具卡正常。
- [ ] 只关 toolCards：footer 正常。
- [ ] 只关 header：其余 chrome 正常。
- [ ] 只关 editor：恢复 pi 默认编辑器。
- [ ] 只关 working：恢复 pi 默认 working 行。
- [ ] 只关 status：footer 不再出现 `working` 状态。
- [ ] 只关 markdown：方言 mermaid 停止渲染，正文恢复原文。
- [ ] `enabled: false`：完全恢复 pi 默认外观与命令集（除 `/ds-ui`）。

## M2 Header

- [ ] 宽度 ≥64 时显示 13 行像素鲸鱼 + `DEEPSEEK`/`PI` 大字 + 模型/effort + cwd + tip。
- [ ] 鲸鱼下方显示居中的欢迎语 `DeepSeek Pi · Terminal UI`。
- [ ] 宽度 40–63 时显示鲸鱼 + 一行名称 + 模型/cwd/tip + 欢迎语。
- [ ] 宽度 <40 时降级为纯文本；<16 时只留名称。
- [ ] `header.logo: false` 时始终纯文本，但仍显示模型/cwd/tip/欢迎语。
- [ ] 切换 dsh-dark / dsh-light，鲸鱼颜色保持 DeepSeek 蓝，文本跟随主题。
- [ ] 与 feynman 同时加载时，`resources_discover` 后 header 是 pi-ds-tui。
- [ ] 被其他扩展覆盖后，`/ds-header` 能立刻拿回 header。
- [ ] `header.enabled: false` 后恢复 pi 内置 header。

## M2 Editor

- [ ] 输入框首行出现 `❯`，颜色跟随 borderColor。
- [ ] 中文 IME 候选窗位置正确。
- [ ] 粘贴 20 行显示折叠标记，不丢内容。
- [ ] 输入 `/`、`@`、Tab 补全正常。
- [ ] Ctrl+C / Ctrl+D / 模型切换快捷键正常。
- [ ] `editor.enabled: false` 后恢复 pi 默认编辑器。

## M2 Working row

- [ ] 发送长回答时显示自定义文案与 spinner。
- [ ] 流式开始/结束没有重复行。
- [ ] `working.message` 为 null 时显示 pi 默认文案。
- [ ] `working.enabled: false` 后恢复默认。

## M3 Widgets（已移除）

- 目标/todo 面板与 `/ds-widgets` 已移除；使用 `@juicesharp/rpiv-todo`。
- pi-ds-tui 不再注册 editor widget，也不读写 `widgets` 配置。

## M4 Markdown

- [ ] 标准 `` ```mermaid `` 图由 pi 内置渲染器显示，pi-ds-tui 不改写。
- [ ] `` ```statediagram ``、`` ```classdiagram ``、`` ```erdiagram ``、`` ```sequencediagram `` 显示为 Unicode 图。
- [ ] 图宽超出终端时显示带 `mermaid:` 标题的源码框，不横向溢出。
- [ ] 未知 fence（如 `plantuml`）保持原样。
- [ ] 未闭合的方言 fence 原样保留：不转换、不丢行、不重复。
- [ ] 流式输出时方言 fence 暂不渲染，结束后一次成型，不闪烁。
- [ ] 正文与代码块里的 `<context>`、`<commit_analysis>` 等标签完全保持原样。
- [ ] 用户输入与 thinking 内容不被改写。
- [ ] `markdown.mermaid: false` 后方言 fence 显示为源码。
- [ ] 40/60/80/120/160 列下图表与源码框都不溢出。
