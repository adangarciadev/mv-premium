/**
 * Providers Index
 * Central export for all provider components
 *
 * NOTE: AppProvider and queryClient are NOT exported here to avoid
 * bundling TanStack Query and Sonner into content scripts.
 * Import them directly when needed in the Options Page.
 */

export { LiteAppProvider } from './lite-app-provider' // Lite provider (for Content Scripts)
