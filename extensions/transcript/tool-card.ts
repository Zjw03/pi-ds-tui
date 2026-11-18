/**
 * Tool-card renderer resolver. M1 only claims `read`; every other tool keeps
 * pi's renderer through `next()`.
 */
import type {
  AgentToolResult,
  Theme,
  ToolRendererResolver,
  ToolRenderResultOptions,
} from '@earendil-works/pi-coding-agent'
import type { ToolRenderContext } from './types.ts'
import type { ToolCardsConfig } from '../config.ts'
import { ReadCallCard } from './tool-call.ts'
import { ReadResultCard } from './tool-result.ts'

export function createReadRenderer(config: ToolCardsConfig): ToolRendererResolver {
  return (toolName, next) => {
    if (toolName !== 'read') return next()
    return {
      renderCall: (args: unknown, theme: Theme, context: ToolRenderContext) =>
        new ReadCallCard(args, theme, context),
      renderResult: (
        result: AgentToolResult<unknown>,
        options: ToolRenderResultOptions,
        theme: Theme,
        context: ToolRenderContext,
      ) => new ReadResultCard(result, options, theme, context, config),
    }
  }
}
