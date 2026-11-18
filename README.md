# pi-ds-tui

dsh-tui style UI for [pi](https://github.com/earendil-works/pi), built only on pi's public extension APIs.

> Status: **M5 complete, `/ds-config` added**. The package ships a dsh-style footer, header, editor prefix, working row, status line, Markdown dialect rendering, tool cards and an in-terminal settings panel. Permission prompts and the todo panel are intentionally not implemented; use your dedicated permission and `@juicesharp/rpiv-todo` packages.

## Install

```bash
pi install git:github.com/Zjw03/pi-ds-tui
```

For one-off development runs:

```bash
cd /path/to/pi-ds-tui
pi -e .
```

Pick `dsh-dark` or `dsh-light` in `/settings` → Theme. `/ds-ui` prints the resolved config path, every switch and any warnings; settings are re-read on `/reload`.

The package is `private` while the UI is under construction. Remove `"private": true` from `package.json` before publishing.

## Config

The config file lives at `~/.pi/agent/pi-ds-tui.json`. A missing file means defaults; malformed values fall back field by field and show a warning.

Run `/ds-config` to edit it in place: every toggle is written immediately, unknown keys are preserved, and the extension reloads when you close the panel. Type to filter the list, Enter/Space to change a value, `Esc` to close.

```jsonc
{
  "enabled": true,
  "footer": {
    "enabled": true,
    "chips": ["model", "context", "tokens", "cache", "cost", "git", "mode", "effort", "cwd"],
    "narrowWidth": 60
  },
  "header": { "enabled": true, "logo": true },
  "editor": { "enabled": true, "prefix": "❯" },
  "working": { "enabled": true, "message": null },
  "markdown": { "enabled": true, "mermaid": true },
  "toolCards": { "enabled": true, "diffMode": "auto", "collapsedLines": 24 },
  "autocomplete": { "enabled": true },
  "messages": { "enabled": true },
  "entries": { "enabled": true },
  "status": { "enabled": true },
  "mouse": { "enabled": false }
}
```

Use `/ds-ui` to print the resolved path, whether the file was found, and any warnings.

## Features

| Feature | Entry | Config switch |
| --- | --- | --- |
| dsh-style footer: cwd, context, tokens, cache, cost, git, mode, effort, model | automatic | `footer.enabled` |
| Header: DeepSeek whale + `DEEPSEEK`/`PI` block wordmark + model/effort + cwd + tip + tagline | automatic | `header.enabled` / `header.logo` |
| Editor: `❯` prompt glyph, app keybindings/autocomplete/IME preserved | automatic | `editor.enabled` |
| Working row: custom message and spinner frames | automatic | `working.enabled` |
| Status line: `working` while the agent runs, cleared when settled | automatic | `status.enabled` |
| Tool cards for `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, `ls`: status dot, one-line argument, duration, collapse/expand | automatic | `toolCards.enabled` |
| Edit diffs: unified below 120 columns, two columns above; colors from `toolDiff*` tokens | automatic | `toolCards.diffMode` |
| Other tools (MCP, subagents, plugins) keep their own renderers | automatic | — |
| Settings panel: toggle every switch, write back to `pi-ds-tui.json`, reload | `/ds-config` | always available |
| Markdown: dialect Mermaid (`statediagram`, `classdiagram`, `erdiagram`, `sequencediagram`) as Unicode art | automatic | `markdown.enabled` / `markdown.mermaid` |
| Config status | `/ds-ui` | always available |

The footer drops low-priority chips on narrow terminals in this order:
cost → cache → tokens → git → effort → mode. Context and the model stay.

Standard `mermaid` fences are left to Pi's built-in renderer. Dialect fences are rendered with the same `lovely-mermaid` engine Pi uses, because Pi's built-in transformer runs before extension transformers.

## Commands

| Command | Description |
| --- | --- |
| `/ds-ui` | Show config path, feature switches, and warnings |
| `/ds-header` | Re-apply the pi-ds-tui header |
| `/ds-tools` | Expand or collapse every tool result |
| `/ds-config` | Edit `pi-ds-tui.json` in a settings overlay; saves on change and reloads |

## Troubleshooting

### Header still shows another extension's banner

pi has one header slot. An extension loaded before pi-ds-tui can set its header from an async `session_start` handler (feynman does this after scanning resources), which would otherwise win the race. pi-ds-tui re-applies its header on `resources_discover`, which pi emits after every `session_start` handler has settled. Run `/ds-header` to reclaim the slot manually.

Also confirm pi-ds-tui is actually loaded: `pi list` should show it, or run `pi -e .` from the project directory. The header cannot appear if the extension is not loaded at all.

## Themes

`dsh-dark` and `dsh-light` map dsh-tui's semantic palette onto pi's 56 color tokens. Select them in `/settings` → Theme.

## Development

```bash
npm install
npm run verify        # typecheck + tests + public-API gate + theme gate
npm run typecheck
npm test
npm run check:public-api
npm run check:themes
npm run preview:markdown   # render tests/fixtures/markdown-demo.md at 40/60/80/120 columns
```

To try the extension without installing it:

```bash
cd /path/to/pi-ds-tui
pi -e .
```

`-e` follows package discovery, so `pi.extensions` and `pi.themes` in `package.json` both load. To keep it loaded in every session, install the local checkout:

```bash
pi install /path/to/pi-ds-tui     # or pi install git:github.com/Zjw03/pi-ds-tui
```

The config file is read from `~/.pi/agent/pi-ds-tui.json`; `/ds-ui` prints the resolved path and any warnings. Settings are re-read on `/reload`.

Manual smoke tests are in [tests/manual.md](tests/manual.md).

## Layout

```text
extensions/
  index.ts            extension entry (/ds-ui, /ds-header)
  config.ts           config schema, defaults, validation, file IO
  configPanel.ts      /ds-config settings list and overlay layout
  ui/
    theme.ts          theme wrappers
    text.ts           width-safe truncate/wrap/pad
    cache.ts          width-keyed cache
    component.ts      Component base class
    icons.ts          shared glyphs
    footer.ts         footer snapshot + renderer + component
    header.ts         startup header + splash layout
    whale.ts          13-row DeepSeek pixel whale
    bigfont.ts        5-row DEEPSEEK/PI block wordmark
    editor.ts         CustomEditor subclass with the prompt glyph
    working.ts        working message/indicator
    status.ts         extension status key
  version.ts          header version
  transcript/
    tool-card.ts      registerToolRenderer resolver (claims the built-in tools)
    tool-call.ts      one-line call row per tool
    tool-result.ts    result body: text, diffs, collapse/expand
    diff.ts           display-diff parsing and unified/split rendering
    card.ts           status glyph, header composition, path/command labels
    markdown.ts       dialect Mermaid transformer
    types.ts          public-type derivations
themes/
  dsh-dark.json
  dsh-light.json
scripts/
  check-public-api.mjs
  check-themes.mjs
tests/
  config.test.ts
  width.test.ts
  component.test.ts
  theme.test.ts
  footer.test.ts
  header.test.ts
  editor.test.ts
  working.test.ts
  status.test.ts
  tool-card.test.ts
  config-panel.test.ts
  markdown.test.ts
  manual.md
docs/
  pi-ui-extension-surface.md
  pi-ui-extension-todo.md
```

## Scope

Only UI that pi's public extension surface can replace is implemented:

- header, footer, editor, working row
- tool cards, custom messages/entries, markdown transformation
- autocomplete, notifications
- themes, terminal title, editor content

Permission prompts are **not** part of this package. Use your dedicated permission package; pi-ds-tui does not intercept tool calls or render approval dialogs.

The goal/todo panel is **not** part of this package. Use `@juicesharp/rpiv-todo`; pi-ds-tui does not render a todo widget.

The transcript shell, built-in message components, side panel, pending-message area, and fullscreen internals have no public extension slot and are not implemented. See [docs/pi-ui-extension-surface.md](docs/pi-ui-extension-surface.md) for the full boundary.

## License

MIT
