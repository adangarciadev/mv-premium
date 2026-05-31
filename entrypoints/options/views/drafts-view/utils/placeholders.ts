
import { type TemplateType, type TemplateDataInput, getFieldsForType } from '@/types/templates'

/** Image field keys that need a valid placeholder URL instead of {{placeholder}} text */
export const IMAGE_FIELD_KEYS = new Set(['posterUrl', 'coverUrl', 'bannerUrl'])

/** Array fields that contain image URLs — should be empty in placeholder mode */
export const IMAGE_ARRAY_KEYS = new Set(['screenshots', 'artworks'])

/** A 200x300 neutral gray SVG used as placeholder poster/cover */
export const PLACEHOLDER_IMAGE =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='200' height='300' fill='%2327272a'/%3E%3Ctext x='100' y='150' text-anchor='middle' dominant-baseline='middle' fill='%2352525b' font-family='sans-serif' font-size='14'%3EPreview%3C/text%3E%3C/svg%3E"

/**
 * Generate placeholder data for preview when no real media is selected.
 * Image fields get a valid placeholder SVG, everything else gets {{fieldName}}.
 */
export function generatePlaceholderData(type: TemplateType): TemplateDataInput {
	const fields = getFieldsForType(type)
	const data: Record<string, unknown> = {}

	for (const field of fields) {
		if (IMAGE_FIELD_KEYS.has(field.key)) {
			data[field.key] = PLACEHOLDER_IMAGE
		} else if (IMAGE_ARRAY_KEYS.has(field.key)) {
			data[field.key] = []
		} else if (field.key === 'similarGames') {
			data[field.key] = [{ name: '{{similarGames}}', coverUrl: null }]
		} else if (field.key === 'trailers') {
			data[field.key] = [{ name: '{{trailers}}', url: '#' }]
		} else if (field.key === 'steamStoreUrl') {
			// No Steam card in placeholder mode — only show when a real game is selected
			data[field.key] = null
		} else if (field.isArray) {
			data[field.key] = [`{{${field.key}}}`]
		} else {
			data[field.key] = `{{${field.key}}}`
		}
	}

	return data as unknown as TemplateDataInput
}
