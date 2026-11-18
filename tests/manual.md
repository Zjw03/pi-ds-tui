# M1 手动冒烟清单

> 自动化验证先跑 `npm run verify`。下面这些项需要真实终端与真实 pi。

## 启动

- [ ] `pi -e .`（默认 fullscreen）能启动，无启动报错。
- [ ] `pi -e . --tui-mode regular` 能启动。
- [ ] 输入 `/ds-ui`，能看到 config 路径、footer/toolCards/overlays 开关与 warnings。

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

## 审批 overlay

- [ ] `/ds-approve` 打开居中浮层，标题、tool、detail 可见。
- [ ] 上下键移动 `❯`，Enter 返回 allow/deny/always，Esc 取消。
- [ ] 浮层打开时 editor 不接收输入。
- [ ] 40 列宽下仍可读，不溢出。
- [ ] 连续打开/关闭不叠加、不残留焦点。
- [ ] `overlays.enabled: false` 后 `/ds-approve` 不存在。

## 组合开关

- [ ] 只关 footer：工具卡与 overlay 正常。
- [ ] 只关 toolCards：footer 与 overlay 正常。
- [ ] 只关 overlays：footer 与工具卡正常。
- [ ] 只关 header：其余 chrome 正常。
- [ ] 只关 editor：恢复 pi 默认编辑器。
- [ ] 只关 working：恢复 pi 默认 working 行。
- [ ] 只关 status：footer 不再出现 `working` 状态。
- [ ] `enabled: false`：完全恢复 pi 默认外观与命令集（除 `/ds-ui`）。

## M2 Header

- [ ] 启动时顶部显示 `pi-ds-tui`、版本、快捷键提示。
- [ ] 宽度 80 时两行；宽度 20 时单行；宽度 12 时只剩名称。
- [ ] 切换 dsh-dark / dsh-light，header 颜色正确。
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
