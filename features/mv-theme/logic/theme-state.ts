export type RawMvThemeState = string | { enabled?: boolean } | null | undefined

export function parseMvThemeEnabled(rawTheme: RawMvThemeState): boolean {
	if (!rawTheme) return false
	if (typeof rawTheme !== 'string') return Boolean(rawTheme.enabled)

	try {
		const parsed = JSON.parse(rawTheme) as { enabled?: boolean } | null
		return Boolean(parsed?.enabled)
	} catch {
		return false
	}
}
