/**
 * Tool-card renderer resolver.
 *
 * Claims the built-in file and shell tools and leaves every other tool to the
 * resolvers registered after us and to pi itself, so third-party card
 * renderers (subagents, MCP adapters, plugins) keep working.
 */
import type {
  AgentToolResult,
  Theme,
  ToolRendererResolver,
  ToolRenderResultOptions,
} from '@earendil-works/pi-coding-agent'
import type { ToolRenderContext } from './types.ts'
import type { ToolCardsConfig } from '../config.ts'
import { ToolCallCard } from './tool-call.ts'
import { ToolResultCard } from './tool-result.ts'

/** Tools this extension renders itself. */
export const CLAIMED_TOOLS: ReadonlySet<string> = new Set([
  'read',
  'write',
  'edit',
  'bash',
  'powershell',
  'grep',
  'find',
  'ls',
])

export function createToolRenderers(config: ToolCardsConfig): ToolRendererResolver {
  return (toolName, next) => {
    if (!CLAIMED_TOOLS.has(toolName)) return next()
    return {
      renderCall: (args: unknown, theme: Theme, context: ToolRenderContext) =>
        new ToolCallCard(toolName, args, theme, context),
      renderResult: (
        result: AgentToolResult<unknown>,
        options: ToolRenderResultOptions,
        theme: Theme,
        context: ToolRenderContext,
      ) => new ToolResultCard(toolName, result, options, theme, context, config),
    }
  }
}
