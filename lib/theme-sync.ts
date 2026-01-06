/**
 * Theme Sync Utilities
 *
 * Provides utilities to apply and sync UI theme from storage
 * to DOM elements created outside of React (e.g., container divs for injection points).
 *
 * This ensures theme consistency between the dashboard and content script components.
 *
 * REFACTORED: Implementation moved to lib/theme/
 */

export { applyStoredTheme, applyThemeColorsToShadow, initGlobalThemeListener } from './theme/injector'

export { initGlobalFontListener } from './theme/fonts'
