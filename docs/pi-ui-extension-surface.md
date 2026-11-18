# pi 可扩展 UI 清单

> 范围：只列 pi **公开扩展 API**（`ExtensionAPI` / `ctx.ui`）能改的界面。不能扩展的 UI 一律不在本文范围内，也不建议用内部 import 或原型补丁绕过。
>
> 依据：pi 1.5.2 的 `docs/extensions.md`、`docs/tui.md`、`docs/themes.md`；参考实现 pi-cc-extensions 1.0.21。
>
> 本文只描述"位置、功能、API、约束、参考实现"，不写生命周期与事件时机；何时调用由扩展自行决定。

## 1. 可扩展区域总览

```
┌──────────────────────────────────────────────────────────┐
│ Header                    ← ctx.ui.setHeader             │
├──────────────────────────────────────────────────────────┤
│ Transcript                                               │
│   ├ 工具卡（call / result） ← pi.registerToolRenderer     │
│   ├ 自定义消息             ← pi.registerMessageRenderer   │
│   ├ 自定义条目             ← pi.registerEntryRenderer     │ 
│   ├ Markdown 文本          ← pi.registerMarkdownTransformer │
│   └ thinking 标签          ← ctx.ui.setHiddenThinkingLabel │
│     工具展开状态            ← ctx.ui.setToolsExpanded     │
├──────────────────────────────────────────────────────────┤
│ Working row               ← setWorkingMessage / Indicator│
│ Widget above editor       ← ctx.ui.setWidget             │
│ Editor                    ← ctx.ui.setEditorComponent    │
│ Widget below editor       ← ctx.ui.setWidget(placement)  │
├──────────────────────────────────────────────────────────┤
│ Footer                    ← ctx.ui.setFooter / setStatus │
└──────────────────────────────────────────────────────────┘
   Overlays                  ← ctx.ui.custom / select / confirm / input / editor
   Autocomplete              ← ctx.ui.addAutocompleteProvider
   Terminal title            ← ctx.ui.setTitle
   Theme（全局）              ← package.json 的 pi.themes / setTheme
   Raw input（高级）          ← ctx.ui.onTerminalInput
```

区域顺序以 pi 的实际挂载顺序为准：header → transcript → pending → working → widget above → editor → widget below → footer；overlay 浮在最上层。

## 2. 常驻区域

### 2.1 Header

| 项 | 内容 |
| --- | --- |
| 位置 | 文档最顶部，transcript 之上；fullscreen 下随 transcript 一起滚动 |
| 对应功能 | 替换 pi 内置 header：logo、版本、快捷键提示、changelog |
| API | `ctx.ui.setHeader((tui, theme) => Component)`；传 `undefined` 恢复内置 |
| 约束 | 单槽替换，最后设置者生效；返回 `Component`；每行不得超过传入宽度；主题变化后要清缓存 |
| 参考 | pi-cc-extensions `extensions/feature/shell/startup-header.ts` |

### 2.2 Footer

| 项 | 内容 |
| --- | --- |
| 位置 | 屏幕最底部，editor 与 widget below 之下 |
| 对应功能 | 替换内置 footer：cwd、git 分支、token、context%、model、thinking level、扩展状态 |
| API | `ctx.ui.setFooter((tui, theme, footerData) => Component)`；`undefined` 恢复内置 |
| 辅助 | `ctx.ui.setStatus(key, text \| undefined)` 写入扩展状态行；自定义 footer 通过 `footerData.getExtensionStatuses()` 读取 |
| 约束 | 单槽替换；`footerData` 还提供 git 分支等宿主数据；状态行按 key 排序 |
| 参考 | `extensions/feature/shell/footer.ts`、`footer-layout.ts` |

### 2.3 Editor

| 项 | 内容 |
| --- | --- |
| 位置 | 底部输入区，widget above 之下、widget below/footer 之上；扩展对话框会临时占用这个槽位 |
| 对应功能 | 替换输入框外观与行为，保留补全、粘贴、IME、提交 |
| API | `ctx.ui.setEditorComponent((tui, theme, keybindings) => Component)`；`getEditorComponent()` 读取前一个；`undefined` 恢复 |
| 约束 | 继承 `CustomEditor` 以保留应用快捷键；实现 `Focusable` 并传播 `focused`，否则 IME 候选窗定位错误；`embedWorkingStatus` 可把 working 状态并入编辑器边框 |
| 参考 | `extensions/feature/shell/prompt-editor.ts` |

### 2.4 Widget above / below editor

| 项 | 内容 |
| --- | --- |
| 位置 | `above`：working 行与 editor 之间；`below`：editor 与 footer 之间 |
| 对应功能 | 常驻自定义内容：todo、提示、按钮、单列 dock、预览 |
| API | `ctx.ui.setWidget(key, string[] \| (tui, theme) => Component)`；`{ placement: "belowEditor" }`；`undefined` 清除 |
| 约束 | 按 key 多实例；只有单列宽度，不能做左右分栏；返回 `Component` 时自行处理宽度 |
| 参考 | `extensions/feature/compact-thinking.ts`（thinking 预览）、`extensions/renderer/mouse/interaction.ts`（回底按钮）、`extensions/renderer/table-copy.ts` |

### 2.5 Working row

| 项 | 内容 |
| --- | --- |
| 位置 | editor 上方的状态行 |
| 对应功能 | 改 "Working…" 文案、动画帧、显示/隐藏 |
| API | `ctx.ui.setWorkingMessage(text?)`；`ctx.ui.setWorkingIndicator({ frames, intervalMs })`；`ctx.ui.setWorkingVisible(boolean)` |
| 约束 | 自定义 indicator 的 frame 原样渲染，需要颜色时自己用 `ctx.ui.theme` 上色 |
| 参考 | `extensions/feature/shell/working-message.ts` |

## 3. Transcript 内容

### 3.1 工具卡

| 项 | 内容 |
| --- | --- |
| 位置 | transcript 中每次工具调用所在行 |
| 对应功能 | 决定 `renderCall` 与 `renderResult` 两个 slot 怎么画：标题、参数、结果、耗时、展开态 |
| API | `pi.registerToolRenderer((toolName, next) => ({ renderCall?, renderResult? }))` |
| 约束 | 只改渲染，不改执行；省略的 slot 继承内置渲染；`next()` 返回后续 resolver/内置结果，可组合；必须处理流式 partial 结果 |
| 参考 | `extensions/renderer/default-mode.ts`、`tool/ccstyle-tool.ts`、`tool/tool-io.ts`、`tool/grouping.ts`、`tool/diff/*` |

> pi-cc-extensions 的 default mode 直接 import `ToolExecutionComponent` 并打原型补丁，这不是公开契约。移植时改用 `registerToolRenderer`，不要照抄补丁。

### 3.2 自定义消息

| 项 | 内容 |
| --- | --- |
| 位置 | transcript 中该消息所在行 |
| 对应功能 | 渲染由 `pi.sendMessage()` 产生、参与 LLM 上下文的自定义消息 |
| API | `pi.registerMessageRenderer(customType, (message, options, theme) => Component)` |
| 约束 | 只匹配自己的 `customType`；**不能替换内置 user / assistant 消息**；`options` 提供 `expanded`、`outputPad`、`keyHint()` / `keyText()` |
| 参考 | `extensions/feature/reference/index.ts`（session reference） |

### 3.3 自定义条目

| 项 | 内容 |
| --- | --- |
| 位置 | transcript 中该条目所在行 |
| 对应功能 | 渲染由 `pi.appendEntry()` 产生、仅用于 TUI、不进入 LLM 上下文的条目 |
| API | `pi.registerEntryRenderer(customType, (entry, options, theme) => Component)` |
| 约束 | 只匹配自己的 `customType`；同样不能替换内置消息组件 |
| 参考 | `extensions/feature/agent-summary/index.ts` |

### 3.4 Markdown 文本

| 项 | 内容 |
| --- | --- |
| 位置 | 所有由 pi 内置 Markdown 渲染的正文：助手消息、自定义消息、部分条目 |
| 对应功能 | 渲染前转换 Markdown：mermaid 方言、公式、表格增强、提示标签清理 |
| API | `pi.registerMarkdownTransformer((markdown, context) => string, { messageTypes? })` |
| 约束 | 只改文本，不换组件；按注册顺序链式执行；不要做逐帧昂贵的解析 |
| 参考 | `extensions/renderer/markdown-enhance.ts` |

### 3.5 thinking 标签

| 项 | 内容 |
| --- | --- |
| 位置 | 折叠后的 thinking 块标题 |
| 对应功能 | 改隐藏 thinking 的提示文字 |
| API | `ctx.ui.setHiddenThinkingLabel(label?)`；不传恢复默认 |
| 参考 | `extensions/feature/compact-thinking.ts` |

### 3.6 工具展开状态

| 项 | 内容 |
| --- | --- |
| 位置 | transcript 中工具输出的展开/收起 |
| 对应功能 | 一键展开或收起全部工具输出 |
| API | `ctx.ui.setToolsExpanded(boolean)`；`ctx.ui.getToolsExpanded()` |
| 参考 | 无直接对应；pi-cc-extensions 通过工具卡自身状态实现 |

## 4. 临时 UI

### 4.1 自定义屏幕 / 浮层

| 项 | 内容 |
| --- | --- |
| 位置 | 默认临时占用 editor 所在的交互区；`overlay: true` 时浮在全屏内容之上 |
| 对应功能 | 设置面板、选择器、预览、确认流程、临时全屏页 |
| API | `ctx.ui.custom((tui, theme, keybindings, done) => Component, options?)` |
| options | `overlay`、`width`、`height`、`minWidth`、`maxHeight`、`anchor`、`offsetX/offsetY`、`row/col`、`margin`、`visible(termWidth, termHeight)`、`nonCapturing`、`blocked` |
| 约束 | 返回对象必须实现 `Component`；用 `done(value)` 结束；状态变化后 `invalidate()` + `tui.requestRender()`；含 `Input`/`Editor` 时实现 `Focusable`；不要对 `custom()` 创建的 overlay 调 `hide()`，用 `done()`；等待用户回答时传 `blocked` 让终端显示阻塞状态 |
| 参考 | `extensions/config/panel.ts`（`/ccstyle` 设置）、`extensions/feature/context.ts`（`/context`）、`extensions/renderer/tool/ask-user-question.ts` |

### 4.2 内置对话框

| 项 | 内容 |
| --- | --- |
| 位置 | editor 槽位，临时替换输入框 |
| 对应功能 | 选择、确认、单行输入、多行编辑 |
| API | `ctx.ui.select()`、`confirm()`、`input()`、`editor()`；支持 `timeout` 与 `AbortSignal` |
| 约束 | 先用 `ctx.hasUI` 判断；print/JSON 模式下没有交互 UI |
| 参考 | pi-cc-extensions 主要用 `custom()` 自绘，未直接使用这些对话框 |

### 4.3 Autocomplete

| 项 | 内容 |
| --- | --- |
| 位置 | editor 上的补全弹层 |
| 对应功能 | 在 pi 内置 `/` 与文件补全之上叠加自定义触发符与候选 |
| API | `ctx.ui.addAutocompleteProvider((current) => provider)` |
| provider | `triggerCharacters`、`getSuggestions(lines, line, col, options)`、`applyCompletion(...)`、`shouldTriggerFileCompletion(...)` |
| 约束 | 不匹配时委托给 `current`；不要复制内置补全逻辑 |
| 参考 | `extensions/feature/reference/index.ts`、`extensions/feature/reference/subagent.ts` |

### 4.4 通知

| 项 | 内容 |
| --- | --- |
| 位置 | 由 pi 决定（状态行或 transcript 提示），非阻塞 |
| 对应功能 | 操作结果、警告、错误提示 |
| API | `ctx.ui.notify(message, "info" \| "warning" \| "error")` |
| 约束 | 不等待用户；需要确认时用 `confirm()` 或 `custom()` |
| 参考 | pi-cc-extensions 多处使用 |

## 5. 全局与终端

### 5.1 主题

| 项 | 内容 |
| --- | --- |
| 位置 | 全局颜色：界面、消息、工具、diff、语法、Markdown、选择、滚动条 |
| 对应功能 | 换配色、语法高亮、diff 颜色、Markdown 颜色 |
| API | 包清单 `package.json` 的 `pi.themes`；用户主题 `~/.pi/agent/themes/<name>.json`；`ctx.ui.theme`；`ctx.ui.getAllThemes()` / `getTheme(name)` / `setTheme(name \| Theme)` |
| 约束 | 只接受文档化的 56 个 color token 与 `vars`；`system` 是保留名；用户主题只热重载当前活动主题 |
| 参考 | `themes/cc-dark.json`、`cc-light.json`、`cc-dark-hc.json`、`cc-light-hc.json` |

### 5.2 终端标题

| 项 | 内容 |
| --- | --- |
| 位置 | 终端窗口/标签标题，不在屏幕内容里 |
| 对应功能 | 显示项目名、会话名、状态 |
| API | `ctx.ui.setTitle(title)` |
| 参考 | 无 |

### 5.3 原始输入（高级）

| 项 | 内容 |
| --- | --- |
| 位置 | 终端输入流；可用于自定义按键与鼠标处理 |
| 对应功能 | 接管 pi 未消费的输入、实现自定义 hover / 点击 / 滚动 |
| API | `ctx.ui.onTerminalInput((data) => ({ consume?: boolean } \| undefined))`，返回取消订阅函数 |
| 约束 | fullscreen 的归一化鼠标事件不公开；需要自己解析 SGR 序列；`consume: true` 会吞掉输入，谨慎使用 |
| 参考 | `extensions/renderer/mouse/*`、`extensions/renderer/transcript-mode.ts` |

> 这是公开 API 里最易碎的一块：行为依赖终端与 pi 版本，优先用 `Component.handleMouse` / `MouseRegion` / `ScrollView` 等组件能力。

### 5.4 编辑器内容

| 项 | 内容 |
| --- | --- |
| 位置 | editor 中的文本 |
| 对应功能 | 预填、读取、粘贴（触发 pi 的粘贴折叠处理） |
| API | `ctx.ui.setEditorText(text)`、`getEditorText()`、`pasteToEditor(text)` |
| 参考 | `extensions/feature/shell/prompt-editor.ts` |

## 6. 与 dsh-tui 的对应关系

只列可扩展的部分。

| pi 可扩展 UI | dsh-tui 对应物 | 移植说明 |
| --- | --- | --- |
| 主题 | `src/theme.ts`、`themeCatalog.ts` | token 映射；shimmer、toolDot、presentCard 等无对应项需近似或丢弃 |
| Header | `LogoHeader` | dsh 的 logo 在滚动区内，不是固定 header；改为 `setHeader` 后位置会变 |
| 工具卡 | `AssistantToolUseMessage.tsx`（1,438 行） | 渲染逻辑可复用，JSX 改写成 `Component` |
| 自定义消息 / 条目 | 无直接对应 | dsh 的状态行/通知需要改成消息或条目 |
| Markdown | `Markdown.tsx` + 表格/公式/mermaid | pi-tui 的 `Markdown` 已支持表格与 LaTeX→Unicode；mermaid 走 transformer |
| Working row | `WorkingSpinner`、`ActivityLine` | 文案与帧动画可映射 |
| Widget above | `GoalTodoPanel`、todo/spinner | 单列 dock，可放 |
| Editor | `PromptInput` | 外观可移植；`@` 提及、图片、选区需用 autocomplete / 自定义 editor 扩展 |
| Widget below | 无 | 可用于放状态或提示 |
| Footer | `StatusLine.tsx`（50KB） | 需要裁剪；dsh 的 mode/effort/cache/cost/tps/上下文条比 pi footer 多 |
| Overlays | picker、`AskUserQuestionPanel`、tooltip、图片预览 | 全部走 `ctx.ui.custom()`；权限审批由专门包负责 |
| Autocomplete | `PromptInput` 的补全菜单 | 用 `addAutocompleteProvider` 叠加 |
| thinking 标签 | thinking 折叠标题 | 直接映射 |
| 工具展开 | 展开/收起全部 | 直接映射 |
| 终端标题 | `withTitle` | 直接映射 |

## 7. pi-cc-extensions 参考索引

| 能力 | 参考文件 | 说明 |
| --- | --- | --- |
| 主题 | `themes/cc-*.json` | 4 套主题，56 token |
| Header | `extensions/feature/shell/startup-header.ts` | 替换启动页眉 |
| Footer | `extensions/feature/shell/footer.ts`、`footer-layout.ts` | 多行状态栏与芯片布局 |
| Editor | `extensions/feature/shell/prompt-editor.ts` | `❯` 前缀与自定义编辑器 |
| Working row | `extensions/feature/shell/working-message.ts` | 文案与耗时 |
| Widget | `extensions/feature/compact-thinking.ts`、`renderer/mouse/interaction.ts`、`renderer/table-copy.ts` | thinking 预览、回底按钮、表格复制 |
| 工具卡 | `extensions/renderer/default-mode.ts`、`tool/ccstyle-tool.ts`、`tool/tool-io.ts`、`tool/grouping.ts` | 工具卡接管与分组（注意其内部补丁方式） |
| diff | `extensions/renderer/tool/diff/*` | 13 个文件的富 diff |
| Markdown | `extensions/renderer/markdown-enhance.ts` | mermaid 方言、圈号转换 |
| Overlay | `extensions/config/panel.ts`、`feature/context.ts`、`renderer/tool/ask-user-question.ts` | 设置面板、上下文检查、问卷 |
| 自定义消息 | `extensions/feature/reference/index.ts` | session reference 消息渲染 |
| 自定义条目 | `extensions/feature/agent-summary/index.ts` | 每轮工具摘要条目 |
| Autocomplete | `extensions/feature/reference/index.ts`、`subagent.ts` | `@` 会话/子代理补全 |
| 原始输入 / 鼠标 | `extensions/renderer/mouse/*`、`transcript-mode.ts` | fullscreen 鼠标与转录浏览 |

## 8. 合规红线

- 交互方法先用 `ctx.hasUI` 判断；print / JSON 模式下没有交互 UI。
- 不 import pi 内部模块（例如 `ToolExecutionComponent`），不打原型补丁；只用 `ExtensionAPI` / `ctx.ui` 的公开方法。
- 不在扩展里创建第二套终端渲染器；所有输出走 `Component.render(width): string[]`。
- 每行不得超过传入宽度；用 `truncateToWidth()`、`wrapTextWithAnsi()`、`sliceByColumn()`，不要按字符串长度切。
- 状态变化后调用 `invalidate()` 和 `tui.requestRender()`；主题变化会清缓存，但不会清掉状态里已写入的 ANSI。
- 含输入光标的组件实现 `Focusable`，并在光标前放 `CURSOR_MARKER`，否则 CJK/IME 候选窗会错位。
- 交互优先用 `ctx.ui.custom()`、`select/confirm/input/editor`、`MouseRegion`、`ScrollView`；不要自行接管 alt-screen。
- 不用 `console.log` 或直接写 stdout；诊断走 opt-in 的日志路径。

## 9. 不纳入清单

以下 UI 没有公开扩展槽位，本文不提供方案：

- transcript 外壳与滚动容器、内置 assistant/user 消息组件。
- pending messages 区、loaded resources 区。
- 左右分栏侧栏（只能用 `setWidget` 做单列 dock）。
- fullscreen 的滚动条、搜索面板、文本选择内部实现。
- 常驻的会话树、轨迹页、设置页（只能通过 `ctx.ui.custom()` 临时打开）。
- 运行时主题插件目录（只支持主题文件与 `setTheme`）。

## 10. 推荐实施顺序

### 10.1 排序原则

1. **先全局后局部**：主题先定，后面所有截图才有可比性。
2. **先固定槽位后 transcript 内容**：header / footer / editor 是单槽，改动小、反馈快；工具卡在 transcript 内，风险最高。
3. **先薄切片后铺开**：先用 footer + 一个简单工具卡 + 一个 overlay 验证 `Component` 写法，再批量复制。
4. **先公开 API 后原始输入**：`onTerminalInput` 最后做，能不做就不做。
5. **每个能力一个开关**：任何一块出问题都能单独关掉，不影响其他区域。

### 10.2 顺序表

| 阶段 | 内容 | 依赖 | 产出 | 验收 |
| --- | --- | --- | --- | --- |
| 0 | 基线：主题 JSON、包清单、配置骨架 | 无 | 可切换的 dsh 风格主题 | 56 个 token 全覆盖；窄宽度不溢出 |
| 1 | 薄切片：Footer + 一个简单工具卡 + 一个 overlay | 0 | 端到端可跑的最小闭环 | 三种状态正常；Esc/Enter 不抢键 |
| 2 | Chrome 补全：Header + Editor 外观 + Working row | 1 | 顶部/底部完整 | 输入、IME、粘贴、应用快捷键不回归 |
| 3 | Widget above / below | 2 | todo、提示、按钮、单列 dock | 不挤压 editor/footer；窄屏可隐藏 |
| 4 | Markdown transformer | 1 | mermaid、公式、标签清理 | 表格/公式/mermaid 正常；不重复渲染 |
| 5 | 工具卡铺开：call/result、展开、diff、长输出 | 1、4 | dsh 风格工具卡 | partial、长输出、窄宽度、无 ANSI 溢出 |
| 6 | Overlay 铺开：问卷、picker、设置（权限审批由专门包负责） | 1、5 | 临时 UI 完整 | 焦点、键盘、Esc、blocked、窄屏 |
| 7 | Autocomplete + 编辑器内容 | 2 | `@` 提及、命令补全 | 不抢内置 `/` 与文件补全 |
| 8 | 自定义消息 / 条目 | 1 | 状态、摘要、通知条目 | 只匹配自己的 `customType` |
| 9 | 原始输入 / 鼠标（可选） | 2、6 | hover、点击、滚动 | regular + fullscreen；鼠标关闭仍可键盘操作 |

逐任务的可执行清单见 [pi-ui-extension-todo.md](pi-ui-extension-todo.md)。

### 10.3 为什么不是先做工具卡

工具卡是最大的视觉面，但它同时依赖 `Component` 契约、宽度处理、流式 partial、diff、展开态和长输出截断。第一块就做它，最容易卡住。

先用 Footer 作为第一个 `Component`：代码量小，能快速验证 `invalidate()`、`requestRender()`、主题缓存和窄宽度截断，再把同一套写法复制到工具卡。

### 10.4 并行与冲突

- 主题、Footer、Header、Editor 外观可以并行；但 Header / Footer / Editor 都是单槽，多个扩展会互相覆盖，先确定 owner。
- 工具卡与 Markdown 可以并行；Overlay 依赖 `Component` 基类，放在工具卡之后更稳。
- Editor 早期只换外观与前缀，不要重写编辑逻辑；输入是最高频路径，回归成本最高。

### 10.5 最小可用集

只做：**主题 + Footer + 一个工具卡**。这些覆盖日常可见的大部分区域，且全部走公开 API。

### 10.6 不建议的顺序

- 先做侧栏或 transcript 外壳：没有公开槽位。
- 先做 `onTerminalInput` 鼠标：最易碎，且依赖终端与 pi 版本。
- 先批量移植 126 个展示组件：没有先验证 `Component` 写法。
- 先重写 editor 的编辑逻辑：回归面最大，收益最小。
