export function capitalizeNoteLabel(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) return ''
	return trimmed.charAt(0).toLocaleUpperCase('es-ES') + trimmed.slice(1)
}
