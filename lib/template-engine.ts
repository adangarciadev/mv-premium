/**
 * Template Engine
 *
 * Renders BBCode templates from TemplateBlock arrays and data objects.
 * Supports field interpolation, sections, raw text, and conditional rendering.
 */

import type {
	MediaTemplate,
	TemplateBlock,
	FieldBlock,
	SectionBlock,
	RawBlock,
	TemplateDataInput,
	TemplateType,
} from '@/types/templates'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a value from a data object by key path
 * Supports nested access like "network.name"
 */
function getFieldValue(data: Record<string, unknown>, field: string): unknown {
	const parts = field.split('.')
	let value: unknown = data

	for (const part of parts) {
		if (value === null || value === undefined) return undefined
		if (typeof value !== 'object') return undefined
		value = (value as Record<string, unknown>)[part]
	}

	return value
}

/**
 * Format a date string to Spanish locale
 */
function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString)
		if (isNaN(date.getTime())) return dateString
		return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
	} catch {
		return dateString
	}
}

/**
 * Check if a value is "truthy" for template purposes
 * - Empty arrays are falsy
 * - Zero is truthy (for runtime, episode counts etc.)
 * - Empty strings are falsy
 */
function hasValue(value: unknown): boolean {
	if (value === null || value === undefined) return false
	if (typeof value === 'string') return value.trim().length > 0
	if (Array.isArray(value)) return value.length > 0
	return true
}

/**
 * Convert a value to string for template rendering
 */
function valueToString(value: unknown, separator = ', ', maxItems = 0): string {
	if (value === null || value === undefined) return ''

	if (Array.isArray(value)) {
		const items = maxItems > 0 ? value.slice(0, maxItems) : value
		return items
			.map(item => {
				const str = valueToString(item)
				// Auto-wrap image URLs in [img] tags
				if (typeof item === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(item)) {
					return `[img]${str}[/img]`
				}
				return str
			})
			.join(separator)
	}

	if (typeof value === 'number') {
		return String(value)
	}

	if (typeof value === 'object') {
		// Handle special object types
		const obj = value as Record<string, unknown>

		// Network objects with name/logoUrl
		if ('name' in obj && 'logoUrl' in obj) {
			if (obj.logoUrl) {
				return `[img]${obj.logoUrl}[/img]`
			}
			return String(obj.name)
		}

		// Similar game objects with name + optional coverUrl
		if ('name' in obj && 'coverUrl' in obj && !('logoUrl' in obj)) {
			return String(obj.name)
		}

		// Trailer objects with name + url
		if ('name' in obj && 'url' in obj && !('coverUrl' in obj) && !('logoUrl' in obj) && !('episodeCount' in obj)) {
			return `${obj.name}: [media]${obj.url}[/media]`
		}

		// Season objects
		if ('number' in obj && 'episodeCount' in obj) {
			const airYear = obj.airDate ? ` (${String(obj.airDate).split('-')[0]})` : ''
			return `[b]Temporada ${obj.number}[/b]${airYear}: ${obj.episodeCount} episodios`
		}

		// Episode objects
		if ('number' in obj && 'name' in obj && !('episodeCount' in obj)) {
			return `[b]${obj.number}.[/b] ${obj.name}`
		}

		// Website objects
		if ('category' in obj && 'url' in obj) {
			return String(obj.url)
		}

		return JSON.stringify(value)
	}

	return String(value)
}

const MULTILINE_FIELDS = new Set([
	'episodes',
	'seasons',
	'networks',
	'releaseDates',
	'screenshots',
	'steamScreenshots',
	'artworks',
	'trailers',
	'websites',
	'externalGames',
	'languageSupports',
	'similarGames',
	'dlcs',
])

// =============================================================================
// Block Renderers
// =============================================================================

/**
 * Render a field block
 */
function renderFieldBlock(block: FieldBlock, data: Record<string, unknown>): string | null {
	const value = getFieldValue(data, block.field)

	// Handle conditional rendering
	const conditional = block.conditional !== false // Default to true
	if (conditional && !hasValue(value)) {
		return null
	}

	// Convert value to string
	const separator = block.separator ?? ', '
	const maxItems = block.maxItems ?? 0
	let stringValue = valueToString(value, separator, maxItems)

	// Special field formatting
	if (block.field === 'runtime' && typeof value === 'number') {
		stringValue = `${value} min`
	}
	if (block.field === 'episodeRunTime' && typeof value === 'number') {
		stringValue = `${value} min`
	}
	if (block.field === 'averageRuntime' && typeof value === 'number') {
		stringValue = `${value} min`
	}
	if (
		(block.field === 'releaseDate' || block.field === 'firstAirDate' || block.field === 'airDate') &&
		typeof value === 'string'
	) {
		stringValue = formatDate(value)
	}

	// Apply label template
	let content = stringValue
	if (block.label) {
		content = block.label.replace('{{value}}', stringValue)
	}

	// Apply wrapper template
	if (block.wrapper) {
		content = block.wrapper.replace('{{content}}', content)
	}

	// Apply data interpolation to the final string (allows using other fields in label/wrapper)
	content = interpolateString(content, data)

	return content
}

/**
 * Render a section block
 */
function renderSectionBlock(block: SectionBlock, data: Record<string, unknown>): string | null {
	const lines: string[] = []

	// If there's a content field, check if it has value before rendering section
	if (block.contentField) {
		const value = getFieldValue(data, block.contentField)
		if (!hasValue(value)) {
			return null
		}
	}

	// Add the bar
	lines.push(`[bar]${block.sectionTitle}[/bar]`)
	lines.push('')

	// Add content if specified
	if (block.contentField) {
		const value = getFieldValue(data, block.contentField)
		const stringValue = valueToString(value)
		lines.push(stringValue)
	}

	return lines.join('\n')
}

/**
 * Interpolate a string with data values
 * Replaces {{key}} with value from data
 */
function interpolateString(text: string, data: Record<string, unknown>): string {
	return text.replace(/{{([^}]+)}}/g, (match, key) => {
		const field = key.trim()
		const value = getFieldValue(data, field)

		if (!hasValue(value)) return ''
		if (MULTILINE_FIELDS.has(field)) {
			return valueToString(value, '\n')
		}

		return valueToString(value)
	})
}

/**
 * Render a raw block
 * Supports variable interpolation if data is provided
 */
function renderRawBlock(block: RawBlock, data?: Record<string, unknown>): string {
	if (!data) return block.rawText
	return interpolateString(block.rawText, data)
}

/**
 * Render a single block
 */
function renderBlock(block: TemplateBlock, data: Record<string, unknown>): string | null {
	switch (block.type) {
		case 'field':
			return renderFieldBlock(block, data)
		case 'section':
			return renderSectionBlock(block, data)
		case 'raw':
			return renderRawBlock(block, data)
	}
}

// =============================================================================
// Main Template Renderer
// =============================================================================

/**
 * Render a complete template with data
 */
export function renderTemplate(template: MediaTemplate, data: TemplateDataInput): string {
	const dataRecord = data as unknown as Record<string, unknown>
	const lines: string[] = []

	for (const block of template.blocks) {
		const rendered = renderBlock(block, dataRecord)

		if (rendered !== null) {
			lines.push(rendered)

			// Add line break if specified
			if (block.addLineBreak !== false) {
				lines.push('')
			}
		}
	}

	// Clean up: remove trailing empty lines and normalize multiple empty lines
	let result = lines.join('\n')
	result = result.replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
	result = result.trim()

	return result
}

/**
 * Validate a template structure
 */
export function validateTemplate(template: MediaTemplate): { valid: boolean; errors: string[] } {
	const errors: string[] = []

	if (!template.id) {
		errors.push('Template must have an ID')
	}

	if (!template.type) {
		errors.push('Template must have a type')
	}

	if (!template.name) {
		errors.push('Template must have a name')
	}

	if (!Array.isArray(template.blocks)) {
		errors.push('Template must have a blocks array')
	} else {
		template.blocks.forEach((block, index) => {
			if (!block.id) {
				errors.push(`Block at index ${index} must have an ID`)
			}

			if (!block.type) {
				errors.push(`Block at index ${index} must have a type`)
			}

			if (block.type === 'field' && !block.field) {
				errors.push(`Field block at index ${index} must have a field property`)
			}

			if (block.type === 'section' && !block.sectionTitle) {
				errors.push(`Section block at index ${index} must have a sectionTitle property`)
			}

			if (block.type === 'raw' && block.rawText === undefined) {
				errors.push(`Raw block at index ${index} must have a rawText property`)
			}
		})
	}

	return { valid: errors.length === 0, errors }
}

/**
 * Create a unique block ID
 */
export function createBlockId(): string {
	return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new field block
 */
export function createFieldBlock(field: string, options: Partial<FieldBlock> = {}): FieldBlock {
	return {
		id: createBlockId(),
		type: 'field',
		field,
		conditional: true,
		addLineBreak: true,
		...options,
	}
}

/**
 * Create a new section block
 */
export function createSectionBlock(sectionTitle: string, options: Partial<SectionBlock> = {}): SectionBlock {
	return {
		id: createBlockId(),
		type: 'section',
		sectionTitle,
		addLineBreak: true,
		...options,
	}
}

/**
 * Create a new raw block
 */
export function createRawBlock(rawText: string, options: Partial<RawBlock> = {}): RawBlock {
	return {
		id: createBlockId(),
		type: 'raw',
		rawText,
		addLineBreak: true,
		...options,
	}
}

/**
 * Create a new empty template
 */
export function createEmptyTemplate(type: TemplateType, name: string): MediaTemplate {
	return {
		id: `template_${type}_${Date.now()}`,
		type,
		name,
		blocks: [],
		isDefault: false,
		version: 1,
	}
}

/**
 * Convert a block-based default template to raw BBCode with {{placeholders}}.
 * Used to give users an editable starting point from the default templates.
 */
export function defaultTemplateToRawBBCode(template: MediaTemplate): string {
	const lines: string[] = []

	for (const block of template.blocks) {
		let rendered: string | null = null

		switch (block.type) {
			case 'field': {
				const placeholder = `{{${block.field}}}`

				if (block.wrapper) {
					rendered = block.wrapper.replace('{{content}}', placeholder)
				} else if (block.label) {
					rendered = block.label.replace('{{value}}', placeholder)
				} else {
					rendered = placeholder
				}
				break
			}
			case 'section': {
				const sectionLines: string[] = []
				sectionLines.push(`[bar]${block.sectionTitle}[/bar]`)
				sectionLines.push('')
				if (block.contentField) {
					sectionLines.push(`{{${block.contentField}}}`)
				}
				rendered = sectionLines.join('\n')
				break
			}
			case 'raw': {
				rendered = block.rawText
				break
			}
		}

		if (rendered !== null) {
			lines.push(rendered)
			if (block.addLineBreak !== false) {
				lines.push('')
			}
		}
	}

	let result = lines.join('\n')
	result = result.replace(/\n{3,}/g, '\n\n')
	result = result.trim()

	return result
}

/**
 * Clone a template with a new ID
 */
export function cloneTemplate(template: MediaTemplate, newName?: string): MediaTemplate {
	const clonedBlocks = template.blocks.map(block => ({
		...block,
		id: createBlockId(),
	}))

	return {
		...template,
		id: `template_${template.type}_${Date.now()}`,
		name: newName || `${template.name} (copia)`,
		blocks: clonedBlocks,
		isDefault: false,
	}
}
