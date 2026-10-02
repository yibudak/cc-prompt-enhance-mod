export type Enhanced = { previous: string | null }

declare module 'claude-code' {
  interface PluginState {
    'cc-prompt-enhance-mod': { hasDraft: boolean; isBusy: boolean; previous: Enhanced['previous'] }
  }
}
