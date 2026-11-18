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
- [ ] 输入 `/ds-ui`，能看到 config 路径、footer/header/editor/working/status/markdown/toolCards 开关与 warnings。

## Footer

- [ ] 底部出现三行：cwd；context/tokens/cache/cost/git/mode/effort + model；扩展状态。
- [ ] 宽度 120 时所有芯片可见。
- [ ] 宽度 40 时只保留 context 与 model，且不换行、不溢出。
- [ ] 中文/emoji cwd 不破坏对齐。
- [ ] 切换 dsh-dark / dsh-light，颜色正确，无旧颜色残留。
- [ ] `footer.enabled: false` 后恢复 pi 内置 footer。

## read 工具卡

- [ ] 让模型读一个长文件，卡片显示状态点、`read`、路径。
- [ ] 超过 `toolCards.collapsedLines` 时折叠，并显示展开提示。
- [ ] 展开后显示全部行。
- [ ] 流式读取时显示 `reading…`。
- [ ] 错误结果以 `✗` 开头。
- [ ] 窄终端（40 列）下路径中段截断，不溢出。
- [ ] `toolCards.enabled: false` 后恢复 pi 默认 read 卡片。
- [ ] 其他工具（bash/edit/grep）保持 pi 默认渲染。

## 组合开关

- [ ] 只关 footer：工具卡正常。
- [ ] 只关 toolCards：footer 正常。
- [ ] 只关 header：其余 chrome 正常。
- [ ] 只关 editor：恢复 pi 默认编辑器。
- [ ] 只关 working：恢复 pi 默认 working 行。
- [ ] 只关 status：footer 不再出现 `working` 状态。
- [ ] 只关 markdown：方言 mermaid 与提示标签清理都停止，正文恢复原文。
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

## M2 Status line

- [ ] agent 运行时 footer 出现 `working`（key `pi-ds-tui`）。
- [ ] `agent_settled` 后状态清除，不残留。
- [ ] 关闭 `status.enabled` 后不再写入状态。
- [ ] 关闭自定义 footer 时，pi 内置 footer 也能看到该状态。

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
- [ ] assistant 正文中的 `<context>…</context>`、`<commit_analysis>…</commit_analysis>` 等块被移除。
- [ ] 代码块内的同名标签保持原样。
- [ ] 用户输入与 thinking 内容不被清理。
- [ ] `markdown.mermaid: false` 只关闭方言渲染，标签清理仍生效。
- [ ] `markdown.stripPromptTags: false` 只关闭标签清理，方言渲染仍生效。
- [ ] 40/60/80/120/160 列下图表与源码框都不溢出。
