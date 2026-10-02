export type Enhanced = { previous: string | null }

declare module 'claude-code' {
  interface PluginState {
    'prompt-enhance': { hasDraft: boolean; isBusy: boolean; previous: Enhanced['previous'] }
  }
}
