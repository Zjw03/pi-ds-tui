# pi 可扩展 UI 实施 TODO

> 配套文档：[pi-ui-extension-surface.md](pi-ui-extension-surface.md)。本文只列可执行任务，不写时间估算。
>
> 目标：用 pi 公开扩展 API 实现 dsh-tui 风格的 UI。不能扩展的区域不做，也不使用内部 import 或原型补丁。
>
> 状态：M0–M6 完成，X1–X5 完成；M7–M9（autocomplete、自定义消息/条目、鼠标）经核对与 pi 已有能力重复，已标记不做。

## 执行协议

1. **一次只做一项**：按编号顺序执行，完成一项、验证一项、勾选一项，再开始下一项。
2. **先读后写**：开始任务前先读配套文档的相关小节与参考实现；不要凭记忆猜 API。
3. **只用公开 API**：`ExtensionAPI`、`ctx.ui`、`@earendil-works/pi-tui` 的导出。禁止 import pi 内部模块（如 `ToolExecutionComponent`）、禁止原型补丁、禁止自建第二套渲染器。
4. **每项都可回滚**：新增能力必须有配置开关；关闭后行为与未安装扩展一致。
5. **每项都验证**：单元/快照测试 + 至少一次 `pi -e .` 手动冒烟。
6. **遇到不可扩展的需求就停**：记录到本文末尾的"阻塞与决策"，不要用 hack 绕过。
7. **不写 stdout**：调试信息只走 opt-in 文件或 `PI_TUI_WRITE_LOG`。

## 进度总览

> 每完成一项，只改这里和对应小节标题；不要提前勾选。

**M0 脚手架**
- [x] T0.1 建立扩展包骨架
- [x] T0.2 配置加载与校验
- [x] T0.3 主题映射
- [x] T0.4 渲染工具与宽度测试
- [x] T0.5 快照测试骨架
- [x] T0.6 合规门禁

> M0 完成记录：`npm run verify` 通过（23 tests）；2 套主题 × 56 token；`/ds-ui` 已注册。

**M1 薄切片**
- [x] T1.1 Footer 骨架
- [x] T1.2 Footer 芯片与优先级
- [x] T1.3 第一个工具卡（read）
- [x] T1.4 第一个 overlay（审批，已移除：权限由专门包负责）
- [x] T1.5 M1 开关与冒烟

> M1 完成记录：`npm run verify` 通过（48 tests）；footer、read 卡片已接入；审批 overlay 已按需求移除；真机冒烟清单见 `tests/manual.md`。

**M2 Chrome**
- [x] T2.1 Header
- [x] T2.2 Editor 外观
- [x] T2.3 Working row
- [x] T2.4 状态行接入（已移除：pi 已有运行指示）

> M2 完成记录：`npm run verify` 通过（71 tests）；header（鲸鱼 + DEEPSEEK/PI 大字 + 模型/effort + cwd + tip + 欢迎语）、editor 前缀、working row 已接入；状态行因与 pi 运行指示重复而移除；header 在 `resources_discover` 后重新夺回槽位，`/ds-header` 可手动重放；真机清单见 `tests/manual.md`。

**M3 Widgets（已移除）**
- [x] T3.1 Widget above editor（已移除：rpiv-todo 提供）
- [x] T3.2 Widget below editor（已移除）
- [x] T3.3 Widget 清理（已移除）

> M3 说明：目标/todo 面板由 `@juicesharp/rpiv-todo` 提供；pi-ds-tui 不再实现 editor widget，也不读写 `widgets` 配置。

**M4 Markdown**
- [x] T4.1 Transformer 骨架
- [x] T4.2 Mermaid 方言
- [x] T4.3 公式与表格增强
- [x] T4.4 提示标签清理（不做：保持原文）

> M4 完成记录：`npm run verify` 通过；标准 mermaid 交给 pi，方言用 `lovely-mermaid` 渲染；表格/LaTeX 由 pi 原生支持，不重复实现；提示标签按需求保留原样，不再清理。

**M5 工具卡**
- [x] T5.1 卡片外壳
- [x] T5.2 Call 渲染
- [x] T5.3 Result 渲染
- [x] T5.4 Diff 渲染
- [x] T5.5 工具分组（不做：无公开 API）
- [x] T5.6 全局展开状态
- [x] T5.7 特殊工具

> M5 完成记录：`npm run verify` 通过；接管 8 个内置文件/外壳工具，其他工具交给 `next()` 与 pi；diff 按宽度自动单/双栏；折叠密度对齐 pi（read 0 行、bash 5 行、其他 8 行）；展开走 pi 自带的 `ctrl+o`。

**M6 Overlays**
- [x] T6.1 Overlay 基类（不做：只有一个面板）
- [x] T6.2 权限审批（不做，由专门包负责）
- [x] T6.3 问卷面板（不做：rpiv-ask-user-question 已提供）
- [x] T6.4 Picker（不做：pi 内置并已继承主题）
- [x] T6.5 设置面板
- [x] T6.6 预览与 tooltip（不做：pi 已有）

> M6 完成记录：`npm run verify` 通过（104 tests）；只做了 `/ds-config`，其余四项因重复或无公开 API 而不做。

**M7 Autocomplete 与编辑器内容（不做）**
- [x] T7.1 Provider 骨架（不做：pi 已有）
- [x] T7.2 `@` 引用（不做：fff 已提供）
- [x] T7.3 编辑器内容（不做：无调用方）

> M7 说明：pi 自带 `CombinedAutocompleteProvider`（`/` 命令 + 参数补全），`@` 文件补全由 `@ff-labs/pi-fff` 包一层提供；`setEditorText`/`getEditorText`/`pasteToEditor` 只是工具函数，没有对应命令时不起作用。

**M8 消息与条目（不做）**
- [x] T8.1 自定义消息渲染（不做：本包不发消息）
- [x] T8.2 自定义条目渲染（不做：本包不写条目）

> M8 说明：`registerMessageRenderer`/`registerEntryRenderer` 只对自己创建的内容生效；本包没有 `sendMessage`/`appendEntry`，注册后就是死代码。

**M9 原始输入与鼠标（不做）**
- [x] T9.1 开关与空实现（不做）
- [x] T9.2 组件级鼠标（不做：pi 已自动包裹）
- [x] T9.3 回底按钮（不做：已有按键/滚动条）
- [x] T9.4 原始 SGR 兜底（不做）

> M9 说明：pi 对每个 tool renderer 自动套 `MouseRegion`（点击展开）；fullscreen 已有 `fullscreenScrollbar`、`fullscreenWheelScrollLines`、`tui.altScreen.bottom`；`onTerminalInput` 原始解析没有需求。

**横切**
- [x] X1 宽度安全巡检（已有逐组件覆盖）
- [x] X2 主题失效巡检（中在 manual）
- [x] X3 焦点与 IME 巡检（中在 manual）
- [x] X4 开关矩阵
- [x] X5 文档同步

> X 完成记录：`tests/switch-matrix.test.ts` 逐项验证 10 个开关的注册与监听器；`scripts/check-docs.mjs` 把 README/manual 与代码对上（命令、目录树、配置示例、失效特性）。

## 全局完成定义（DoD）

每项任务完成时必须同时满足：

- [ ] `npx tsc --noEmit` 通过。
- [ ] 相关 `node --test tests/<name>.test.ts` 通过。
- [ ] 渲染在宽度 40 / 60 / 80 / 120 / 160 下不超宽、不抛错。
- [ ] regular 与 fullscreen 两种模式都能启动（`pi -e .` / `pi -e . --tui-mode regular`）。
- [ ] light / dark 两套主题下都可见，无 ANSI 颜色泄漏。
- [ ] 配置开关关闭时，无残留 UI、无残留按键监听。
- [ ] 没有新增内部 import、`console.log` 或直接 stdout 写入。

## 验证矩阵

| 维度 | 取值 |
| --- | --- |
| 宽度 | 40、60、80、120、160 |
| 模式 | regular、fullscreen |
| 主题 | dsh-dark、dsh-light |
| 输入 | 纯 ASCII、中文、emoji、宽字符、ANSI |
| 状态 | 空闲、流式 partial、完成、错误、取消 |
| 焦点 | editor、overlay、picker、widget 内输入 |
| 鼠标 | 关闭、点击、拖拽、滚轮（仅 fullscreen） |

## 建议目录

```text
extensions/
  index.ts
  config.ts
  configPanel.ts    # /ds-config 设置面板
  ui/
    theme.ts        # theme 包装与缓存
    text.ts         # truncate/wrap/pad
    icons.ts        # figures
    cache.ts        # 宽度键缓存
    component.ts    # Component 基类/工具
    footer.ts
    header.ts
    editor.ts
    working.ts
  transcript/
    tool-card.ts
    tool-call.ts
    tool-result.ts
    diff.ts
    card.ts
    markdown.ts
tests/
  width.test.ts
  footer.test.ts
  tool-card.test.ts
  markdown.test.ts
  config-panel.test.ts
  switch-matrix.test.ts
```

---

## M0 脚手架与基线

> 状态：已完成。`npm run verify` 全绿；主题校验通过；`/ds-ui` 可读配置。

### T0.1 建立扩展包骨架

- 依赖：无
- 文件：`package.json`、`extensions/index.ts`、`tsconfig.json`
- API：`ExtensionAPI`
- 步骤：
  1. 在 `package.json` 写 `pi.extensions: ["./extensions/index.ts"]` 与 `pi.themes`。
  2. `extensions/index.ts` 导出默认函数，只注册一个空实现。
  3. 加 `typecheck`、`test` 脚本。
- 完成：`pi -e .` 能加载，`/reload` 无报错。
- 验证：`pi -e .`、`npx tsc --noEmit`。

### T0.2 配置加载与校验

- 依赖：T0.1
- 文件：`extensions/config.ts`、`tests/config.test.ts`
- API：无（纯 TS）
- 步骤：
  1. 定义配置类型：各能力的 `enabled` 开关、footer 字段顺序、diff 模式、宽度阈值。
  2. 从 `~/.pi/agent/pi-dsh-ui.json` 读取；缺失用默认值；非法值回退并 `ctx.ui.notify` 一次。
  3. 提供只读快照，避免运行时被改。
- 完成：缺文件、空文件、非法 JSON、未知字段四种情况都有测试。
- 验证：`node --test tests/config.test.ts`。

### T0.3 主题映射

- 依赖：T0.1
- 文件：`themes/dsh-dark.json`、`themes/dsh-light.json`
- API：`pi.themes`、`ctx.ui.setTheme`
- 步骤：
  1. 从 dsh-tui `src/theme.ts` 取语义 token。
  2. 映射到 pi 的 56 个 color token；无对应项用最接近的角色，不新增 key。
  3. `appearance`、`vars` 写完整；不要使用 `system` 作为名字。
- 完成：主题能被 `/settings` 选中；56 个 token 全部有值；无未知 key。
- 验证：`node -e` 校验 JSON；`pi -e .` 切换主题目测。

### T0.4 渲染工具与宽度测试

- 依赖：T0.1
- 文件：`extensions/ui/theme.ts`、`text.ts`、`icons.ts`、`cache.ts`、`component.ts`、`tests/width.test.ts`
- API：`truncateToWidth`、`wrapTextWithAnsi`、`visibleWidth`、`sliceByColumn`
- 步骤：
  1. 封装 `fitLine(text, width)`、`padLine`、`truncateMiddle`。
  2. 封装宽度键缓存：`get(width)` / `clear()`。
  3. 定义 `BaseComponent`：`invalidate()` 清缓存、`render()` 负责宽度。
- 完成：40/60/80/120/160 下 ASCII、中文、emoji、ANSI 均不超宽。
- 验证：`node --test tests/width.test.ts`。

### T0.5 快照测试骨架

- 依赖：T0.4
- 文件：`tests/helpers/render.ts`、`tests/snapshots/*`
- API：无
- 步骤：
  1. 提供 `renderAt(component, width): string[]`。
  2. 断言每行 `visibleWidth <= width`。
  3. 用固定字符串快照，不依赖终端。
- 完成：新增组件能一行接入快照测试。
- 验证：`node --test tests/`。

### T0.6 合规门禁

- 依赖：T0.1
- 文件：`scripts/check-public-api.mjs`、`package.json`
- API：无
- 步骤：
  1. 扫描 `extensions/`，禁止 `@earendil-works/pi-coding-agent/dist` 与内部路径 import。
  2. 禁止 `console.log`、`process.stdout.write`。
  3. 挂到 `test` 或 `verify` 脚本。
- 完成：故意加一行内部 import 时脚本失败。
- 验证：`node scripts/check-public-api.mjs`。

---

## M1 薄切片（Footer + 一个工具卡）

> 状态：已完成。`npm run verify` 全绿；footer 与 read 卡片都有独立开关；审批 overlay 已按需求移除。

### T1.1 Footer 骨架

- 依赖：T0.4、T0.5
- 文件：`extensions/ui/footer.ts`、`tests/footer.test.ts`
- API：`ctx.ui.setFooter((tui, theme, footerData) => Component)`
- 步骤：
  1. 画两行：第一行 cwd；第二行左侧上下文/令牌，右侧 model。
  2. 右侧空间不足时先截断 model，再截断左侧。
  3. 提供 `undefined` 恢复路径。
- 完成：窄宽度不换行、不溢出；model 与 context 可见。
- 验证：`node --test tests/footer.test.ts`；`pi -e .` 对比截图。

### T1.2 Footer 芯片与优先级

- 依赖：T1.1
- 文件：`extensions/ui/footer.ts`
- API：`footerData.getExtensionStatuses()`、`ctx.ui.setStatus`
- 步骤：
  1. 加 git、tokens、cache、cost、mode、effort 芯片。
  2. 定义丢弃顺序：先丢 cost/cache，再丢 tokens，保留 model/context/cwd。
  3. 芯片顺序由配置控制。
- 完成：40 列下仍有 model/context；120 列下全部可见。
- 验证：快照 5 种宽度。

### T1.3 第一个工具卡（read）

- 依赖：T0.4、T0.5
- 文件：`extensions/transcript/tool-card.ts`、`tool-call.ts`、`tool-result.ts`
- API：`pi.registerToolRenderer`
- 步骤：
  1. 只处理 `read`，其余 `return next()`。
  2. `renderCall` 画标题、路径、状态点。
  3. `renderResult` 画内容，超过 N 行折叠并给提示。
  4. 处理 partial 结果。
- 完成：长文件折叠；窄宽度不溢出；未知工具不受影响。
- 验证：`node --test tests/tool-card.test.ts`；`pi -e .` 读一个长文件。

### T1.4 第一个 overlay（审批，已移除）

> 已移除：权限审批由专门的权限包负责。pi-ds-tui 不注册审批 overlay，也不拦截 `tool_call`。

- 原文件：`extensions/overlays/base.ts`、`approval.ts`（已删除）
- 原 API：`ctx.ui.custom(factory, { overlay: true, blocked })`
- 原验证：`node --test tests/overlays.test.ts`（已删除）

### T1.5 M1 开关与冒烟

- 依赖：T1.1–T1.3
- 文件：`extensions/config.ts`、`extensions/index.ts`
- API：无
- 步骤：
  1. 给 footer / tool card 各加开关。
  2. 全部关闭时恢复 pi 默认外观。
  3. 写一段手动冒烟清单到 `tests/manual.md`。
- 完成：任意单项关闭不影响其他项。
- 验证：逐项开关 + `pi -e .`。

---

## M2 Chrome

> 状态：已完成。`npm run verify` 全绿；四项能力都有独立开关；编辑器仍继承 `CustomEditor`。

### T2.1 Header

- 依赖：T1.5
- 文件：`extensions/ui/header.ts`、`tests/header.test.ts`
- API：`ctx.ui.setHeader((tui, theme) => Component)`
- 步骤：
  1. 画 logo/名称、版本、快捷键提示。
  2. 窄宽度逐级降级为单行。
  3. 主题变化时重建。
- 完成：不超宽；`setHeader(undefined)` 能恢复。
- 验证：快照 + `pi -e .`。

### T2.2 Editor 外观

- 依赖：T1.5
- 文件：`extensions/ui/editor.ts`
- API：`ctx.ui.setEditorComponent`、`ctx.ui.getEditorComponent`
- 步骤：
  1. 继承 `CustomEditor`，只改前缀/边框/颜色。
  2. 不重写编辑、补全、粘贴逻辑。
  3. 实现 `Focusable` 与光标标记。
- 完成：中文 IME、粘贴、Ctrl+C/Ctrl+D、模型切换不回归。
- 验证：手动输入中文、粘贴 20 行、触发补全。

### T2.3 Working row

- 依赖：T1.5
- 文件：`extensions/ui/working.ts`
- API：`setWorkingMessage`、`setWorkingIndicator`、`setWorkingVisible`
- 步骤：
  1. 自定义文案与帧。
  2. 与自定义 editor 的 `embedWorkingStatus` 二选一。
- 完成：流式开始/结束无重复行；关闭后恢复默认。
- 验证：发一条长回答，观察开始与结束。

### T2.4 状态行接入（已移除）

> pi 在 agent 运行时已经显示 `WorkingStatusIndicator`（spinner + 文案），再写一个 `working` 状态是重复信号。
> `extensions/ui/status.ts` 与 `status` 配置项已删除。

- 原 API：`ctx.ui.setStatus`
- 原验证：`tests/status.test.ts`（已删除）

---

## M3 Widgets（已移除）

> 目标/todo 面板与 editor 下方提示 widget 已移除。todo 由 `@juicesharp/rpiv-todo` 提供；pi-ds-tui 不再调用 `setWidget`，也不读写 `widgets` 配置。

---

## M4 Markdown

> 状态：已完成。`npm run verify` 全绿；标准 mermaid 交给 pi；方言由 `lovely-mermaid` 渲染；表格/LaTeX 不重复实现；提示标签按需求保持原文。

### T4.1 Transformer 骨架

- 依赖：T1.5
- 文件：`extensions/transcript/markdown.ts`、`tests/markdown.test.ts`
- API：`pi.registerMarkdownTransformer(fn, { messageTypes })`
- 步骤：
  1. 默认原样返回。
  2. 按配置决定是否启用。
  3. 只处理指定 messageTypes。
- 完成：关闭时与 pi 默认输出逐字节一致。
- 验证：快照对比。

### T4.2 Mermaid 方言

> pi 内置的 mermaid transformer 先于扩展 transformer 运行，只认 `mermaid` fence。因此方言不能只改 fence 名：这里用 pi 同款的 `lovely-mermaid` 直接渲染，标准 `mermaid` 仍交给 pi。

- 依赖：T4.1
- 文件：`extensions/transcript/markdown.ts`
- API：同上
- 步骤：
  1. 识别非标准 fence（如 `statediagram`、`classdiagram`）。
  2. 转成 pi 能识别的 mermaid fence。
  3. 普通 mermaid 原样交给 pi。
- 完成：不重复渲染；未知 fence 不改。
- 验证：三种 fence 的快照。

### T4.3 公式与表格增强

> pi-tui 已支持 GFM 表格与 LaTeX→Unicode。本项不新增转换，只用测试锁定这些输入不被 transformer 改写。

- 依赖：T4.1
- 文件：`extensions/transcript/markdown.ts`
- 步骤：
  1. 先确认 pi-tui 已支持的表格/公式，不重复实现。
  2. 只补 pi 不支持的部分。
  3. 避免正则回溯。
- 完成：表格/公式正常；大输入不卡顿。
- 验证：10KB Markdown 基准。

### T4.4 提示标签清理（不做）

> 已决定不实现：正文与代码块里的 `<context>`、`<commit_analysis>` 等标签保持模型写入的原样，不做任何隐藏或删除。

- 原计划文件：`extensions/transcript/markdown.ts`
- 完成：transformer 对这些标签逐字返回。
- 验证：`prompt tags and user text are untouched`。

---

## M5 工具卡铺开

> 状态：已完成。`npm run verify` 全绿；接管 8 个内置工具，其他工具交给 `next()`。

### T5.1 卡片外壳

- 依赖：T1.3
- 文件：`extensions/transcript/tool-card.ts`、`card.ts`
- API：`registerToolRenderer`
- 实现：
  1. 一个状态点 + 工具名 + 参数 + `·` 元信息（行号/计数/耗时）。
  2. 外壳用 pi 默认 `renderShell`，背景与左右边距走 pi 的 Box（`toolPendingBg` / `toolSuccessBg` / `toolErrorBg`）。
  3. 只接管 `read`、`write`、`edit`、`bash`、`powershell`、`grep`、`find`、`ls`；其余工具 `next()`，保留第三方 renderer。
- 完成：8 个工具都有统一外壳；未知参数不报错；其他工具不受影响。
- 验证：`resolver claims built-in tools and defers everything else`。

### T5.2 Call 渲染

- 依赖：T5.1
- 文件：`extensions/transcript/tool-call.ts`
- 实现：
  1. `read` 显示 `路径:offset+limit`；`write` 显示 `+N lines`；`edit` 显示 `N edits`。
  2. `bash`/`powershell` 显示命令并保留尾部（左侧省略）。
  3. `grep`/`find` 显示 pattern，`in path` 作为第二段；`ls` 显示目录。
  4. `write` 展开时在标题下预览内容（上限 400 行）。
- 完成：每族都有断言；40/60/80/120/160 列均不溢出。
- 验证：`tests/tool-card.test.ts`。

### T5.3 Result 渲染

- 依赖：T5.1
- 文件：`extensions/transcript/tool-result.ts`
- 实现：
  1. 文本按 `collapsedLines` 折叠；`bash`/`powershell` 保留尾部，其他保留头部。
  2. 空结果：流式显示 `running…`，否则不占行。
  3. 错误正文用 error token；图片在未开内联图片时显示 `[image …]`。
  4. `details.truncation` / `fullOutputPath` 追加一行 dim 提示。
- 完成：有内容后不再追加状态行，不会因 partial 抖动。
- 验证：`result collapses…`、`bash result keeps the newest lines`、`error results…`。

### T5.4 Diff 渲染

- 依赖：T5.3
- 文件：`extensions/transcript/diff.ts`
- 实现：
  1. 解析 pi edit 的显示 diff（`+123 content` / `-123 content` / ` 123 content`）。
  2. `auto`：`>= 120` 列双栏，否则单栏；`split` / `unified` 可强制。
  3. 双栏按 `-` 与 `+` 序号配对，上下文两侧重复。
  4. 超过 `collapsedLines` 折叠并追加 `… +N lines`。
- 完成：20–160 列 × 三种模式均不溢出；颜色走 `toolDiffAdded` / `toolDiffRemoved` / `toolDiffContext`。
- 验证：`diff rendering never exceeds the width`。

### T5.5 工具分组（不做）

> 已确认不可行：`registerToolRenderer` 只决定单个 tool call 的渲染，无法把相邻调用合并成一个组件。
> 要分组必须接管整个 transcript，而那是公开 API 不提供的能力（同侧栏）。

### T5.6 全局展开状态（已移除）

> pi 自带 `ctrl+o`（`app.tools.expand`）切换全部工具输出，`/ds-tools` 只是同一动作的第二个入口，已删除。
> 卡片本身仍从 `options.expanded` / `context.expanded` 读取展开态。

### T5.7 特殊工具

- 依赖：T5.2、T5.3
- 文件：`extensions/transcript/tool-result.ts`
- 实现：
  1. 图片结果：未开内联图片时给出占位符，不重复渲染 pi 的图片组件。
  2. MCP / subagent / web fetch / todo：不接管，交给对应扩展或 pi 的通用渲染。
  3. 结构异常的 args/details 全部按缺失处理。
- 完成：不接管就不会覆盖第三方卡片；自己的 8 个工具都有兜底。
- 验证：`describeCall tolerates missing and malformed arguments`。

---

## M6 Overlays（只做设置面板）

> 状态：已完成。`npm run verify` 全绿；只新增 `/ds-config`，其余 overlay 因重复或无公开 API 而不做。

### T6.1 Overlay 基类（不做）

> 本包只有 `/ds-config` 一个弹层，不需要基类；引入基类只为单一实现增加一层间接。

### T6.2 权限审批（不实现）

> 权限审批由专门的权限包负责。pi-ds-tui 不注册审批 overlay，也不拦截 `tool_call`。

- 原文件：`extensions/overlays/approval.ts`（已删除）
- 原验证：`tests/overlays.test.ts`（已删除）

### T6.3 问卷面板（不做）

> `@juicesharp/rpiv-ask-user-question` 已提供完整交互式提问（单选/多选/自由文本）。再做一遍只会抢同一个触发点。

### T6.4 Picker（不做）

> pi 的 `/model`、`/settings` 等内置 picker 使用 `accent` / `muted` / `dim` token，已经跟着 dsh 主题变色。重写只会得到同样的外观，还要自己维护 `Esc` / IME / 搜索。

### T6.5 设置面板

- 依赖：T0.2
- 文件：`extensions/configPanel.ts`、`extensions/config.ts`
- API：`ctx.ui.custom(factory)`（不带 `overlay`，与 `/settings` 一样接管 editor 区域）；`@earendil-works/pi-tui` 的 `SettingsList`
- 实现：
  1. 16 项开关按 `CONFIG_FIELDS` 生成，值从文件读，缺失用默认值。
  2. `Enter`/`Space` 循环取值；布尔为 `on`/`off`，`diffMode` 三态，`collapsedLines` 枚举。
  3. 每次变更立即写盘：临时文件 + rename，保留未知 key。
  4. 写盘失败在列表下方显示一行错误，不关面板、不崩溃。
  5. `Esc` 关闭；若写过盘则 `ctx.reload()` 应用新配置。
  6. `/ds-config` 在 `enabled: false` 时仍注册，否则无法从面板里重新开启。
  7. 外观对齐 `/settings`：上下各一条 `borderMuted` 全宽分隔线，无标题、无背景色块。
- 完成：40–120 列不溢出；只改一项时文件其余内容不动；非浮层。
- 验证：`tests/config-panel.test.ts`、`tests/index.test.ts`（断言不加 `overlay`）。

### T6.6 预览与 tooltip（不做）

> 图片预览与工具卡展开由 pi 自身处理，本包没有额外的预览需求。

---

## M7 Autocomplete 与编辑器内容（不做）

> 结论：全部不做。
> - pi 已有 `CombinedAutocompleteProvider`：`/` 命令、参数补全、`@` 文件补全。
> - `@` 文件补全由已安装的 `@ff-labs/pi-fff` 包在 `current` 外面提供（FFF 索引），不需要再写一层。
> - `setEditorText` / `getEditorText` / `pasteToEditor` 是给命令用的工具函数，本包没有需要它们的命令。
> - dsh 独有的 `@session` / `@subagent` 引用在 `pi-cc-extensions/extensions/feature/reference` 里已有实现（约 1.1k 行），属于功能而非皮肤；需要时应单独立项或直接启用那个包。

### T7.1 Provider 骨架（不做）

- 原文件：`extensions/input/autocomplete.ts`
- 原 API：`ctx.ui.addAutocompleteProvider`

### T7.2 `@` 引用（不做）

- 原文件：`extensions/input/autocomplete.ts`

### T7.3 编辑器内容（不做）

- 原 API：`ctx.ui.setEditorText`、`getEditorText`、`pasteToEditor`

---

## M8 自定义消息与条目（不做）

> 结论：全部不做。两个 API 只对**本扩展自己创建的内容**生效：
> - `registerMessageRenderer(customType, …)` —— 需要先用 `pi.sendMessage` 发带该 `customType` 的消息。
> - `registerEntryRenderer(customType, …)` —— 需要先用 `pi.appendEntry` 写带该 `customType` 的条目。
> 本包不发消息、不写条目，注册后就是永远不执行的死代码。

### T8.1 自定义消息渲染（不做）

- 原文件：`extensions/transcript/messages.ts`
- 原 API：`pi.registerMessageRenderer`

### T8.2 自定义条目渲染（不做）

- 原文件：`extensions/transcript/entries.ts`
- 原 API：`pi.registerEntryRenderer`、`pi.appendEntry`

---

## M9 原始输入与鼠标（不做）

> 结论：整块不做。pi 已经把这件事做完了：
> - 每个 tool renderer 都被 `MouseRegion` 包住，**点击即展开/收起**（`tool-execution.js` 的 `createResultRegion`）。
> - fullscreen 已有 `fullscreenScrollbar`、`fullscreenWheelScrollLines`、`fullscreenCopyOnSelect`。
> - 回底已有 `tui.altScreen.bottom`（“Scroll viewport to bottom”）。
> - `onTerminalInput` 原始 SGR 解析在 TODO 里本来就写着“仅必要时”，现在不需要。

### T9.1 开关与空实现（不做）

- 原文件：`extensions/input/mouse.ts`

### T9.2 组件级鼠标（不做）

- 原 API：`Component.handleMouse`、`MouseRegion`
- 现状：pi 自动包裹，已生效。

### T9.3 回底按钮（不做）

- 原文件：`extensions/ui/widgets.ts`
- 现状：键位与滚动条已覆盖。

### T9.4 原始 SGR 兜底（不做）

- 原 API：`onTerminalInput`

---

## 横切任务

### X1 宽度安全巡检

> 状态：已完成（分散在现有测试里，不单独建矩阵）。

| 组件 | 覆盖宽度 | 测试 |
| --- | --- | --- |
| footer | 30 / 40 / 120 | `tests/footer.test.ts` |
| header | 40 / 64 / 120 | `tests/header.test.ts` |
| tool cards | 40 / 60 / 80 / 120 / 160 | `tests/tool-card.test.ts` |
| diff | 20 / 40 / 80 / 120 / 160 | `tests/tool-card.test.ts` |
| config panel | 40 / 60 / 80 / 120 | `tests/config-panel.test.ts` |
| markdown | 8 / 20 / 40 / 80 | `tests/markdown.test.ts` |
| editor / working / whale / bigfont | 对应专测 | `tests/*.test.ts` |

- 完成：每个组件的每个宽度都有 `assertWidth`，无一行超宽。
- 验证：`npm test`。

### X2 主题失效巡检

> 状态：已完成（手动清单）。

- 实现保证：header/footer 工厂接收 `() => ctx.ui.theme`，每次渲染读当前主题；编辑器等组件由 pi 在主题切换时重建。
- 验证：`tests/manual.md` 的 Footer / Header 小节均有“切换 dsh-dark / dsh-light，无旧颜色残留”。

### X3 焦点与 IME 巡检

> 状态：已完成（手动清单）。

- 覆盖：editor 中文输入与候选窗、`/ds-config` 搜索框、Esc 不误触、关闭后焦点回 editor。
- 验证：`tests/manual.md` 的 M2 Editor 与 M6 小节。

### X4 开关矩阵

> 状态：已完成（`tests/switch-matrix.test.ts`，11 个用例）。

- 做法：每个用例建一个临时 HOME，写入对应配置，用 `?matrix=N` 打破 ESM 缓存重新加载扩展；然后断言命令、事件监听、transformer、renderer 与 UI 调用。
- 覆盖：全部开关、单项关闭、`enabled: false`、全关、意外监听器、状态写入。
- 验证：`node --test tests/switch-matrix.test.ts`。

### X5 文档同步

> 状态：已完成（`scripts/check-docs.mjs`，已接入 `npm run verify`）。

- 检查：README 命令表 ↔ 实际注册；README 目录树 ↔ 磁盘（`extensions/` 双向）；配置示例 ↔ `DEFAULT_CONFIG`；相对链接；已删除特性的残留字符串。
- TODO 不参与残留检查（它记录历史）。
- 验证：`npm run check:docs`。

---

## 阻塞与决策

> 执行中遇到公开 API 无法满足的需求，记录在这里；不要用内部补丁绕过。

| 日期 | 任务 | 需求 | 结论 |
| --- | --- | --- | --- |
| — | — | — | — |
