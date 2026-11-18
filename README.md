# pi-ds-tui

dsh-tui style UI for [pi](https://github.com/earendil-works/pi), built only on pi's public extension APIs.

> Status: **M2 chrome**. The package ships a dsh-style footer, header, editor prefix, working row, status line, a `read` tool card, and an approval overlay, all gated by config switches.

## Install

```bash
pi install git:github.com/Zjw03/pi-ds-tui
```

For one-off development runs:

```bash
pi -e .
```

The package is `private` while the UI is under construction. Remove `"private": true` from `package.json` before publishing.

## Config

The config file lives at `~/.pi/agent/pi-ds-tui.json`. A missing file means defaults; malformed values fall back field by field and show a warning.

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
  "widgets": { "above": true, "below": false, "maxHeight": 8 },
  "markdown": { "enabled": true, "mermaid": true, "stripPromptTags": true },
  "toolCards": { "enabled": true, "diffMode": "auto", "collapsedLines": 24 },
  "overlays": { "enabled": true },
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
| Header: DeepSeek whale logo + name, version, key hints; text-only on narrow terminals | automatic | `header.enabled` / `header.logo` |
| Editor: `❯` prompt glyph, app keybindings/autocomplete/IME preserved | automatic | `editor.enabled` |
| Working row: custom message and spinner frames | automatic | `working.enabled` |
| Status line: `working` while the agent runs, cleared when settled | automatic | `status.enabled` |
| `read` tool card: status dot, path, line range, duration, collapse/expand | automatic | `toolCards.enabled` |
| Approval overlay: Allow / Deny / Always allow | `/ds-approve` | `overlays.enabled` |
| Config status | `/ds-ui` | always available |

The footer drops low-priority chips on narrow terminals in this order:
cost → cache → tokens → git → effort → mode. Context and the model stay.

## Commands

| Command | Description |
| --- | --- |
| `/ds-ui` | Show config path, feature switches, and warnings |
| `/ds-header` | Re-apply the pi-ds-tui header |
| `/ds-approve` | Preview the approval overlay (TUI only) |

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
```

Manual smoke tests are in [tests/manual.md](tests/manual.md).

## Layout

```text
extensions/
  index.ts            extension entry (/ds-ui, /ds-approve)
  config.ts           config schema, defaults, validation
  ui/
    theme.ts          theme wrappers
    text.ts           width-safe truncate/wrap/pad
    cache.ts          width-keyed cache
    component.ts      Component base class
    icons.ts          shared glyphs
    footer.ts         footer snapshot + renderer + component
    header.ts         startup header + whale layout
    whale.ts          13-row DeepSeek pixel whale
    editor.ts         CustomEditor subclass with the prompt glyph
    working.ts        working message/indicator
    status.ts         extension status key
  version.ts          header version
  transcript/
    tool-card.ts      registerToolRenderer resolver
    tool-call.ts      read call row
    tool-result.ts    read result body
    types.ts          public-type derivations
  overlays/
    base.ts           bordered panel helper
    approval.ts       approval overlay + /ds-approve
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
  overlays.test.ts
  manual.md
docs/
  pi-ui-extension-surface.md
  pi-ui-extension-todo.md
```

## Scope

Only UI that pi's public extension surface can replace is implemented:

- header, footer, editor, widgets, working row
- tool cards, custom messages/entries, markdown transformation
- overlays, autocomplete, notifications
- themes, terminal title, editor content

The transcript shell, built-in message components, side panel, pending-message area, and fullscreen internals have no public extension slot and are not implemented. See [docs/pi-ui-extension-surface.md](docs/pi-ui-extension-surface.md) for the full boundary.

## License

MIT
