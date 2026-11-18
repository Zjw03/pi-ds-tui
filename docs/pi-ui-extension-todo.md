# pi 可扩展 UI 实施 TODO

> 配套文档：[pi-ui-extension-surface.md](pi-ui-extension-surface.md)。本文只列可执行任务，不写时间估算。
>
> 目标：用 pi 公开扩展 API 实现 dsh-tui 风格的 UI。不能扩展的区域不做，也不使用内部 import 或原型补丁。

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
- [x] T1.4 第一个 overlay（审批）
- [x] T1.5 M1 开关与冒烟

> M1 完成记录：`npm run verify` 通过（48 tests）；footer、read 卡片、审批 overlay 已接入；真机冒烟清单见 `tests/manual.md`。

**M2 Chrome**
- [x] T2.1 Header
- [x] T2.2 Editor 外观
- [x] T2.3 Working row
- [x] T2.4 状态行接入

> M2 完成记录：`npm run verify` 通过（66 tests）；header、editor 前缀、working row、状态行已接入；真机清单见 `tests/manual.md`。

**M3 Widgets**
- [ ] T3.1 Widget above editor
- [ ] T3.2 Widget below editor
- [ ] T3.3 Widget 清理

**M4 Markdown**
- [ ] T4.1 Transformer 骨架
- [ ] T4.2 Mermaid 方言
- [ ] T4.3 公式与表格增强
- [ ] T4.4 提示标签清理

**M5 工具卡**
- [ ] T5.1 卡片外壳
- [ ] T5.2 Call 渲染
- [ ] T5.3 Result 渲染
- [ ] T5.4 Diff 渲染
- [ ] T5.5 工具分组
- [ ] T5.6 全局展开状态
- [ ] T5.7 特殊工具

**M6 Overlays**
- [ ] T6.1 Overlay 基类
- [ ] T6.2 审批面板完整版
- [ ] T6.3 问卷面板
- [ ] T6.4 Picker
- [ ] T6.5 设置面板
- [ ] T6.6 预览与 tooltip

**M7 Autocomplete 与编辑器**
- [ ] T7.1 Provider 骨架
- [ ] T7.2 `@` 引用
- [ ] T7.3 编辑器内容

**M8 消息与条目**
- [ ] T8.1 自定义消息渲染
- [ ] T8.2 自定义条目渲染

**M9 原始输入与鼠标（可选）**
- [ ] T9.1 开关与空实现
- [ ] T9.2 组件级鼠标
- [ ] T9.3 回底按钮
- [ ] T9.4 原始 SGR 兜底（仅必要时）

**横切**
- [ ] X1 宽度安全巡检
- [ ] X2 主题失效巡检
- [ ] X3 焦点与 IME 巡检
- [ ] X4 开关矩阵
- [ ] X5 文档同步

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
    widgets.ts
  transcript/
    tool-card.ts
    tool-call.ts
    tool-result.ts
    diff.ts
    grouping.ts
    markdown.ts
    messages.ts
    entries.ts
  overlays/
    base.ts
    approval.ts
    questions.ts
    pickers.ts
    settings.ts
    preview.ts
  input/
    autocomplete.ts
    mouse.ts
tests/
  width.test.ts
  footer.test.ts
  tool-card.test.ts
  overlays.test.ts
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

## M1 薄切片（Footer + 一个工具卡 + 一个 overlay）

> 状态：已完成。`npm run verify` 全绿；三项能力都有独立开关；`/ds-approve` 可手动触发。

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

### T1.4 第一个 overlay（审批）

- 依赖：T0.4、T0.5
- 文件：`extensions/overlays/base.ts`、`approval.ts`
- API：`ctx.ui.custom(factory, { overlay: true, blocked })`
- 步骤：
  1. 画标题、说明、Allow / Deny / Always 选项。
  2. 上下键选择，Enter 确认，Esc 取消。
  3. `done(result)` 结束；焦点不泄漏到 editor。
- 完成：窄屏可读；blocked 状态正确；重复打开不叠加。
- 验证：`node --test tests/overlays.test.ts`；手动触发一次确认。

### T1.5 M1 开关与冒烟

- 依赖：T1.1–T1.4
- 文件：`extensions/config.ts`、`extensions/index.ts`
- API：无
- 步骤：
  1. 给 footer / tool card / overlay 各加开关。
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

### T2.4 状态行接入

- 依赖：T1.1
- 文件：`extensions/ui/footer.ts`
- API：`ctx.ui.setStatus`
- 步骤：
  1. 用一个稳定 key 写活动状态。
  2. 自定义 footer 读取 `footerData.getExtensionStatuses()`。
  3. 清除时传 `undefined`。
- 完成：不残留旧状态；多个 key 按字母排序。
- 验证：开关两次，检查 footer。

---

## M3 Widgets

### T3.1 Widget above editor

- 依赖：T2.3
- 文件：`extensions/ui/widgets.ts`
- API：`ctx.ui.setWidget(key, factory)`（默认 placement）
- 步骤：
  1. 画 todo/目标面板，支持折叠。
  2. 高度上限由配置控制。
- 完成：不挤压 editor；窄屏自动收起。
- 验证：快照 + 手动折叠。

### T3.2 Widget below editor

- 依赖：T3.1
- 文件：`extensions/ui/widgets.ts`
- API：`ctx.ui.setWidget(key, factory, { placement: "belowEditor" })`
- 步骤：
  1. 画提示/快捷键/状态。
  2. 与 footer 不重复。
- 完成：不遮挡 footer；关闭后消失。
- 验证：快照 + 手动。

### T3.3 Widget 清理

- 依赖：T3.1、T3.2
- 文件：`extensions/ui/widgets.ts`
- API：`setWidget(key, undefined)`
- 步骤：
  1. 每个 widget 有独立 key。
  2. 关闭开关或退出时清理。
- 完成：反复开关不叠加、不残留空行。
- 验证：连续开关 5 次。

---

## M4 Markdown

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

- 依赖：T4.1
- 文件：`extensions/transcript/markdown.ts`
- 步骤：
  1. 先确认 pi-tui 已支持的表格/公式，不重复实现。
  2. 只补 pi 不支持的部分。
  3. 避免正则回溯。
- 完成：表格/公式正常；大输入不卡顿。
- 验证：10KB Markdown 基准。

### T4.4 提示标签清理

- 依赖：T4.1
- 文件：`extensions/transcript/markdown.ts`
- 步骤：
  1. 只清理已知的分析标签。
  2. 不破坏代码块内的同名文本。
- 完成：代码块原样保留；正文标签被移除。
- 验证：含代码块的样例。

---

## M5 工具卡铺开

### T5.1 卡片外壳

- 依赖：T1.3
- 文件：`extensions/transcript/tool-card.ts`
- API：`registerToolRenderer`
- 步骤：
  1. 统一标题、状态点、耗时、折叠/展开。
  2. 背景与边框走主题 token。
- 完成：所有工具名都能落到外壳；未知工具有兜底。
- 验证：快照 + 手动。

### T5.2 Call 渲染

- 依赖：T5.1
- 文件：`extensions/transcript/tool-call.ts`
- 步骤：
  1. 按工具族画参数：read/write/edit/bash/grep/glob/web/task/mcp。
  2. 路径中段截断；命令保留尾部。
- 完成：每族都有快照；窄宽度不溢出。
- 验证：`tests/tool-card.test.ts`。

### T5.3 Result 渲染

- 依赖：T5.1
- 文件：`extensions/transcript/tool-result.ts`
- 步骤：
  1. 处理文本、代码、JSON、图片。
  2. 超长折叠；给展开提示。
  3. partial 更新不闪烁。
- 完成：四种结果类型都有快照。
- 验证：手动流式工具调用。

### T5.4 Diff 渲染

- 依赖：T5.3
- 文件：`extensions/transcript/diff.ts`
- 步骤：
  1. 解析 unified diff。
  2. 宽度 ≥ 阈值用双栏，否则单栏。
  3. 超长 diff 折叠，展开显示全部。
- 完成：120 列双栏、80 列单栏；ANSI 不泄漏。
- 验证：edit/write 各一次。

### T5.5 工具分组

- 依赖：T5.1
- 文件：`extensions/transcript/grouping.ts`
- 步骤：
  1. 连续同类调用合并为一组。
  2. 组级展开/折叠。
- 完成：组内状态正确；不吞掉错误。
- 验证：连续 5 次 read。

### T5.6 全局展开状态

- 依赖：T5.1
- 文件：`extensions/transcript/tool-card.ts`
- API：`ctx.ui.setToolsExpanded`、`getToolsExpanded`
- 步骤：
  1. 注册一个命令/按键切换。
  2. 切换后重建所有卡片缓存。
- 完成：一次性展开/收起全部。
- 验证：20 个工具调用。

### T5.7 特殊工具

- 依赖：T5.2、T5.3
- 文件：`extensions/transcript/tool-*.ts`
- 步骤：
  1. 处理图片、web fetch、task/subagent、MCP。
  2. 无法识别的结构退回文本。
- 完成：每种都有兜底；不抛错。
- 验证：样例结果快照。

---

## M6 Overlays

### T6.1 Overlay 基类

- 依赖：T1.4
- 文件：`extensions/overlays/base.ts`
- API：`ctx.ui.custom`
- 步骤：
  1. 统一尺寸、锚点、margin、`visible`。
  2. 统一 Esc/Enter/焦点处理。
  3. 统一 `done()` 与清理。
- 完成：所有 overlay 复用同一基类。
- 验证：窄屏、resize、隐藏/显示。

### T6.2 审批面板完整版

- 依赖：T6.1
- 文件：`extensions/overlays/approval.ts`
- 步骤：
  1. 允许/拒绝/始终允许；详情可滚动。
  2. 键盘优先；鼠标可选。
- 完成：blocked 正确；取消不残留。
- 验证：手动触发三种结果。

### T6.3 问卷面板

- 依赖：T6.1
- 文件：`extensions/overlays/questions.ts`
- 步骤：
  1. 多问题、单选/多选、自由文本。
  2. 预览与说明区域。
- 完成：焦点在输入框时 IME 正常；Esc 取消。
- 验证：中文输入 + 多问题。

### T6.4 Picker

- 依赖：T6.1
- 文件：`extensions/overlays/pickers.ts`
- API：`SelectList` / `SettingsList`
- 步骤：
  1. 模型、effort、mode 三个 picker。
  2. 搜索与选中态。
- 完成：窄屏可读；选中结果回传。
- 验证：每个 picker 手动一次。

### T6.5 设置面板

- 依赖：T6.1、T0.2
- 文件：`extensions/overlays/settings.ts`
- 步骤：
  1. 分页展示配置。
  2. 修改后写回配置文件；非法值提示。
- 完成：重启后保留；非法值不写盘。
- 验证：改三项并重启。

### T6.6 预览与 tooltip

- 依赖：T6.1
- 文件：`extensions/overlays/preview.ts`
- 步骤：
  1. 图片/长文本预览。
  2. 关闭后焦点回到原组件。
- 完成：叠加两个 overlay 时关闭顺序正确。
- 验证：连续打开/关闭。

---

## M7 Autocomplete 与编辑器内容

### T7.1 Provider 骨架

- 依赖：T2.2
- 文件：`extensions/input/autocomplete.ts`
- API：`ctx.ui.addAutocompleteProvider`
- 步骤：
  1. 匹配自定义触发符。
  2. 不匹配时委托 `current`。
- 完成：`/` 与文件补全行为不变。
- 验证：输入 `/`、`@`、`Tab`。

### T7.2 `@` 引用

- 依赖：T7.1
- 文件：`extensions/input/autocomplete.ts`
- 步骤：
  1. 会话/子代理候选。
  2. 插入后光标位置正确。
- 完成：不重复插入；取消不改变文本。
- 验证：三次插入/取消。

### T7.3 编辑器内容

- 依赖：T2.2
- 文件：`extensions/ui/editor.ts`
- API：`setEditorText`、`getEditorText`、`pasteToEditor`
- 步骤：
  1. 提供预填/读取/粘贴入口。
  2. 大粘贴走 pi 的折叠处理。
- 完成：粘贴 50 行后显示折叠标记。
- 验证：手动。

---

## M8 自定义消息与条目

### T8.1 自定义消息渲染

- 依赖：T1.5
- 文件：`extensions/transcript/messages.ts`
- API：`pi.registerMessageRenderer`
- 步骤：
  1. 定义 `customType`。
  2. 渲染标题、正文、展开详情。
- 完成：只匹配自己的类型；内置消息不变。
- 验证：快照 + 手动。

### T8.2 自定义条目渲染

- 依赖：T8.1
- 文件：`extensions/transcript/entries.ts`
- API：`pi.registerEntryRenderer`、`pi.appendEntry`
- 步骤：
  1. 渲染摘要条目。
  2. 不进入 LLM 上下文。
- 完成：不重复、不丢条目。
- 验证：连续追加 3 条。

---

## M9 原始输入与鼠标（可选）

### T9.1 开关与空实现

- 依赖：T6.1
- 文件：`extensions/input/mouse.ts`
- API：`ctx.ui.onTerminalInput`
- 步骤：
  1. 默认关闭。
  2. 开启后只记录，不消费。
- 完成：关闭时零影响。
- 验证：开关两次。

### T9.2 组件级鼠标

- 依赖：T9.1、T5.1
- 文件：`extensions/transcript/tool-card.ts`
- API：`Component.handleMouse`、`MouseRegion`
- 步骤：
  1. 先做 hover/点击展开。
  2. 只在 fullscreen 生效。
- 完成：regular 模式仍可键盘操作。
- 验证：两种模式各一次。

### T9.3 回底按钮

- 依赖：T3.1、T9.2
- 文件：`extensions/ui/widgets.ts`
- API：`setWidget`
- 步骤：
  1. 滚离底部时显示，点击回底。
  2. 与 footer/widget 不重叠。
- 完成：窄屏隐藏；点击后消失。
- 验证：长 transcript。

### T9.4 原始 SGR 兜底（仅必要时）

- 依赖：T9.2
- 文件：`extensions/input/mouse.ts`
- API：`onTerminalInput`
- 步骤：
  1. 只在组件级鼠标无法满足时启用。
  2. 解析按下/释放/拖拽/滚轮。
  3. 退出时取消订阅。
- 完成：不吞普通按键；关闭后无监听。
- 验证：终端矩阵（Windows Terminal / iTerm2 / Ghostty）。

---

## 横切任务

### X1 宽度安全巡检

- 依赖：M5、M6 完成
- 步骤：对每个组件跑 40/60/80/120/160 快照。
- 完成：无一行超宽。
- 验证：`node --test tests/`。

### X2 主题失效巡检

- 依赖：M2 完成
- 步骤：切换 light/dark，检查所有缓存组件重建。
- 完成：无旧颜色残留。
- 验证：手动切换 3 次。

### X3 焦点与 IME 巡检

- 依赖：M6、M7 完成
- 步骤：在 editor、问卷、设置、picker 中输入中文。
- 完成：候选窗位置正确；Esc 不误触。
- 验证：手动。

### X4 开关矩阵

- 依赖：全部功能
- 步骤：逐项关闭，确认无残留。
- 完成：任意组合下都能启动。
- 验证：`pi -e .` × 组合。

### X5 文档同步

- 依赖：全部功能
- 步骤：更新本文件勾选状态、配置说明、手动冒烟清单。
- 完成：文档与实现一致。
- 验证：对照检查。

---

## 阻塞与决策

> 执行中遇到公开 API 无法满足的需求，记录在这里；不要用内部补丁绕过。

| 日期 | 任务 | 需求 | 结论 |
| --- | --- | --- | --- |
| — | — | — | — |
