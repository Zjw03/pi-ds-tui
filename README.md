# pi-ds-tui

dsh-tui style UI for [pi](https://github.com/earendil-works/pi), built only on pi's public extension APIs.

> Status: **M0 scaffold**. The package currently loads a validated config, ships two themes, and provides width-safe render helpers. UI registrations arrive in later milestones.

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
    "chips": ["model", "context", "tokens", "cache", "cost", "git", "cwd"],
    "narrowWidth": 60
  },
  "header": { "enabled": true },
  "editor": { "enabled": true, "prefix": "❯" },
  "working": { "enabled": true, "message": null },
  "widgets": { "above": true, "below": false, "maxHeight": 8 },
  "markdown": { "enabled": true, "mermaid": true, "stripPromptTags": true },
  "toolCards": { "enabled": true, "diffMode": "auto", "collapsedLines": 24 },
  "overlays": { "enabled": true },
  "autocomplete": { "enabled": true },
  "messages": { "enabled": true },
  "entries": { "enabled": true },
  "mouse": { "enabled": false }
}
```

Use `/ds-ui` to print the resolved path, whether the file was found, and any warnings.

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

## Layout

```text
extensions/
  index.ts            extension entry (/ds-ui)
  config.ts           config schema, defaults, validation
  ui/
    theme.ts          theme wrappers
    text.ts           width-safe truncate/wrap/pad
    cache.ts          width-keyed cache
    component.ts      Component base class
    icons.ts          shared glyphs
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
