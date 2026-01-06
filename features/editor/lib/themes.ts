/**
 * Theme management for code highlighting
 *
 * Optimized: Single theme (github-dark) to reduce bundle size
 * CSS is now loaded on-demand via highlight-setup.ts
 */

// Single theme - removed theme selector to save ~50KB
export const CODE_THEME = { id: 'github-dark', name: 'GitHub Dark' }

// Keep THEMES array for backwards compatibility
export const THEMES = [CODE_THEME]

/**
 * Retrieves the currently active code theme (statically GitHub Dark)
 */
export async function getStoredTheme(): Promise<string> {
	return 'github-dark'
}

// Simplified: no-op since there's only one theme
export async function setStoredTheme(_themeId: string): Promise<void> {
	// no-op (single theme)
}

export function applyTheme(_themeId?: string) {
	// no-op: CSS is shipped via normal CSS bundling
}

export async function initThemes() {
	// no-op
}
