#!/usr/bin/env node
/**
 * Public-API gate.
 *
 * pi extensions may import the package roots, but not internal dist/src paths,
 * and must not take over pi's renderer with prototype patches or write to
 * stdout while the TUI owns the terminal.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../extensions/', import.meta.url))
const RULES = [
  { pattern: /@earendil-works\/pi-coding-agent\/(dist|src)\//, message: 'internal pi package path' },
  { pattern: /\bToolExecutionComponent\b/, message: 'internal ToolExecutionComponent' },
  { pattern: /console\.log\s*\(/, message: 'console.log' },
  { pattern: /process\.stdout\.write\s*\(/, message: 'process.stdout.write' },
]

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) files.push(path)
  }
  return files
}

const errors = []
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        errors.push(`${relative(process.cwd(), file)}:${index + 1}: ${rule.message}`)
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`public-api error: ${error}`)
  process.exit(1)
}

console.log('public-api: ok')
